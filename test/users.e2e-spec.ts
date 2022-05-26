import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getConnection, Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Verification } from 'src/users/entities/verification.entity';

jest.mock('got', () => {
  return {
    post: jest.fn(),
  };
});

const GRAPHQL_ENDPOINT = '/graphql';

const testUser = {
  email: 'test@email.com',
  password: '1234',
  role: 'Client',
};

describe('UserModule (e2e)', () => {
  let app: INestApplication;
  let usersRepository: Repository<User>;
  let verifiationRepository: Repository<Verification>;
  let jwtToken: string;

  const baseTest = () => request(app.getHttpServer()).post(GRAPHQL_ENDPOINT);
  const publicTest = (query: string) => baseTest().send({ query });
  const privateTest = (query: string) =>
    baseTest().set('X-JWT', jwtToken).send({ query });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    verifiationRepository = module.get<Repository<Verification>>(
      getRepositoryToken(Verification),
    );
    await app.init();
  });

  afterAll(async () => {
    await getConnection().dropDatabase();
    app.close();
  });

  describe('createAccount', () => {
    it('should create account', async () => {
      return publicTest(`
      mutation {
        createAccount(input: {
          email:"${testUser.email}",
          password:"${testUser.password}",
          role:${testUser.role}
        }) {
          ok
          err
        }
      }
      `)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.createAccount.ok).toBe(true);
          expect(res.body.data.createAccount.err).toBe(null);
        });
    });

    it('should fail if account already exists', () => {
      return publicTest(`
      mutation{
          createAccount(input:{
            email:"${testUser.email}"
            password:"${testUser.password}"
            role:${testUser.role}
          }){
            ok,
            err
          }
        }`)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                createAccount: { ok, err },
              },
            },
          } = res;
          expect(ok).toBe(false);
          expect(err).toEqual(expect.any(String));
        });
    });
  });

  describe('login', () => {
    it('should login with correct credentials', () => {
      return publicTest(`
      mutation{
          login(input:{
            email:"${testUser.email}"
            password:"${testUser.password}"
          }){
            ok,
            err,
            token
          }
        }`)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: { login },
            },
          } = res;
          expect(login.ok).toBe(true);
          expect(login.err).toBe(null);
          expect(login.token).toEqual(expect.any(String));
          jwtToken = login.token;
        });
    });

    it('should not be able to login with wrong password', () => {
      return publicTest(`
      mutation{
          login(input:{
            email:"${testUser.email}"
            password:""
          }){
            ok,
            err,
            token
          }
        }`)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: { login },
            },
          } = res;
          expect(login.ok).toBe(false);
          expect(login.err).toEqual(expect.any(String));
          expect(login.token).toBe(null);
        });
    });
  });

  describe('userProfile', () => {
    let userId: number;

    beforeAll(async () => {
      const [user] = await usersRepository.find();
      userId = user.id;
    });

    it("should see a user's profile", () => {
      return privateTest(`
          {
            userProfile(userId:${userId}){
              ok
              err
              user {
                id
              }
            }  
          }
            `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                userProfile: {
                  ok,
                  err,
                  user: { id },
                },
              },
            },
          } = res;
          expect(ok).toBe(true);
          expect(err).toBe(null);
          expect(id).toBe(userId);
        });
    });

    it('should not find a user', () => {
      return privateTest(`
          {
            userProfile(userId:999){
              ok
              err
              user {
                id
              }
            }
          }
        `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                userProfile: { ok, err, user },
              },
            },
          } = res;
          expect(ok).toBe(false);
          expect(err).toEqual(expect.any(String));
          expect(user).toBe(null);
        });
    });
  });

  describe('me', () => {
    it('should find my profile', () => {
      return privateTest(`
          {
            me{
              email
            }
          }
          `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                me: { email },
              },
            },
          } = res;
          expect(email).toBe(testUser.email);
        });
    });

    it('should not allow logged out user', () => {
      return publicTest(`
          {
            me {
              email
            }  
          }
            `)
        .expect(200)
        .expect((res) => {
          const {
            body: { errors },
          } = res;
          const [error] = errors;
          expect(error.message).toEqual(expect.any(String));
        });
    });
  });

  describe('editProfile', () => {
    const NEW_EMAIL = 'new.email.com';

    it('should change email', () => {
      return privateTest(`
          mutation{
            editProfile(input:{
              email: "${NEW_EMAIL}"
            }){
              ok
              err
            }
          }
          `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                editProfile: { ok, err },
              },
            },
          } = res;
          expect(ok).toBe(true);
          expect(err).toBe(null);
        });
    });

    it('should have a new email', () => {
      return privateTest(`
        {
          me{
            email
          }
        }
        `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                me: { email },
              },
            },
          } = res;
          expect(email).toBe(NEW_EMAIL);
        });
    });
  });

  describe('verifyEmail', () => {
    let verificationCode: string;

    beforeAll(async () => {
      const [verification] = await verifiationRepository.find();
      verificationCode = verification.code;
    });

    it('should verify email', () => {
      return publicTest(`
          mutation{
            verifyEmail(input:{
              code:"${verificationCode}"
            }){
              ok
              err
            }
          }
          `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                verifyEmail: { ok, err },
              },
            },
          } = res;
          expect(ok).toBe(true);
          expect(err).toBe(null);
        });
    });

    it('should fail on verification code not found', () => {
      return publicTest(`
          mutation{
            verifyEmail(input:{
              code:"x"
            }){
              ok
              err
            }
          }
          `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                verifyEmail: { ok, err },
              },
            },
          } = res;
          expect(ok).toBe(false);
          expect(err).toEqual(expect.any(String));
        });
    });
  });
});
