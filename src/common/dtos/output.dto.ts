import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CoreOutput {
  @Field((type) => String, { nullable: true })
  err?: string;

  @Field((type) => Boolean)
  ok: boolean;
}
