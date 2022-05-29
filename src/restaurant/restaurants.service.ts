import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Like, Raw, Repository } from 'typeorm';
import {
  CreateResaurantOutput,
  CreateRestaurantInput,
} from './dtos/create-restaurant.dto';
import {
  EditRestaurantInput,
  EditRestaurantOutput,
} from './dtos/eidt-restaurant.dto';
import { Category } from './entities/category.entity';
import {
  DeleteRestaurantInput,
  DeleteRestaurantOutput,
} from './dtos/delete-restaurant.dto';
import { Restaurant } from './entities/restaurant.entity';
import { CategoryRepository } from './repositories/category.repository';
import { AllCategoriesOutput } from './dtos/all-categories.dto';
import { CategoryInput, CategoryOutput } from './dtos/category.dto';
import { RestaurantsInput, RestaurantsOutput } from './dtos/restaurants.dto';
import { RestaurantInput, RestaurantOutput } from './dtos/restaurant.dto';
import {
  SearchRestaurantInput,
  SearchRestaurantOutput,
} from './dtos/search-restaurant.dto';

@Injectable()
export class RestaurantService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    private readonly categories: CategoryRepository,
  ) {}

  async createRestaurant(
    owner: User,
    createRestaurantInput: CreateRestaurantInput,
  ): Promise<CreateResaurantOutput> {
    try {
      const newRestaurant = this.restaurants.create(createRestaurantInput);
      newRestaurant.owner = owner;
      const category = await this.categories.getOrCreate(
        createRestaurantInput.categoryName,
      );
      newRestaurant.category = category;
      await this.restaurants.save(newRestaurant);
      return {
        ok: true,
      };
    } catch (err) {
      return {
        ok: false,
        err: 'Could not create restaurant',
      };
    }
  }

  async editRestaurant(
    owner: User,
    editRestauarntInput: EditRestaurantInput,
  ): Promise<EditRestaurantOutput> {
    try {
      const restaurant = await this.restaurants.findOne(
        editRestauarntInput.restaurantId,
        { loadRelationIds: true },
      );
      if (!restaurant) {
        return {
          ok: false,
          err: 'Restaurant not found',
        };
      }
      if (owner.id !== restaurant.ownerId) {
        return {
          ok: false,
          err: "You can't edit a restaurant that you don't own",
        };
      }
      let category: Category = null;
      if (editRestauarntInput.categoryName) {
        category = await this.categories.getOrCreate(
          editRestauarntInput.categoryName,
        );
      }
      await this.restaurants.save([
        {
          id: editRestauarntInput.restaurantId,
          ...editRestauarntInput,
          ...(category && { category }),
        },
      ]);
      return {
        ok: true,
      };
    } catch (err) {
      return {
        ok: false,
        err: 'Could not edit restaurant',
      };
    }
  }

  async deleteRestaurant(
    owner: User,
    { restaurantId }: DeleteRestaurantInput,
  ): Promise<DeleteRestaurantOutput> {
    try {
      const restaurant = await this.restaurants.findOne(restaurantId);
      if (!restaurant) {
        return {
          ok: false,
          err: 'Restaurant not found',
        };
      }
      if (owner.id !== restaurant.ownerId) {
        return {
          ok: false,
          err: "You can't delete a restaurant that you don't own",
        };
      }
      await this.restaurants.delete(restaurantId);
      return {
        ok: true,
      };
    } catch (err) {
      return {
        ok: false,
        err: 'Coudl not delete restaurant',
      };
    }
  }

  async allCategories(): Promise<AllCategoriesOutput> {
    try {
      const categories = await this.categories.find();
      return {
        ok: true,
        categories,
      };
    } catch {
      return {
        ok: false,
        err: 'Could not load categories',
      };
    }
  }

  countRestaurants(category: Category) {
    return this.restaurants.count({ category });
  }

  async findCategoryBySlug({
    slug,
    page,
  }: CategoryInput): Promise<CategoryOutput> {
    try {
      const category = await this.categories.findOne({ slug });
      if (!category) {
        return {
          ok: false,
          err: 'Category not found',
        };
      }
      const restaurants = await this.restaurants.find({
        where: {
          category,
        },
        take: 25,
        skip: (page - 1) * 25,
      });
      category.restaurants = restaurants;
      const totalResults = await this.countRestaurants(category);
      return {
        ok: true,
        category,
        totalPages: Math.ceil(totalResults / 25),
      };
    } catch {
      return {
        ok: false,
        err: 'Could not load category',
      };
    }
  }

  async allResturants({ page }: RestaurantsInput): Promise<RestaurantsOutput> {
    try {
      const [restaurants, totalResults] = await this.restaurants.findAndCount({
        skip: (page - 1) * 25,
        take: 25,
      });
      return {
        ok: true,
        results: restaurants,
        totalPages: Math.ceil(totalResults / 25),
        totalResults,
      };
    } catch {
      return {
        ok: false,
        err: 'Could not load restaurants',
      };
    }
  }

  async findRestaurantById({
    restaurantId,
  }: RestaurantInput): Promise<RestaurantOutput> {
    try {
      const restaurant = await this.restaurants.findOne(restaurantId);
      if (!restaurant) {
        return {
          ok: false,
          err: 'Restaurant not found',
        };
      }
      return {
        ok: true,
        restaurant,
      };
    } catch {
      return {
        ok: false,
        err: 'Could not find restaurant',
      };
    }
  }

  async searchRestaurantByName({
    query,
    page,
  }: SearchRestaurantInput): Promise<SearchRestaurantOutput> {
    try {
      const [restaurants, totalResults] = await this.restaurants.findAndCount({
        where: {
          name: Raw((name) => `${name} ILIKE '%${query}%'`),
        },
        skip: (page - 1) * 25,
        take: 25,
      });
      if (!restaurants) {
        return {
          ok: false,
          err: 'Resaurant not found',
        };
      }
      return {
        ok: true,
        restaurants,
        totalResults,
        totalPages: Math.ceil(totalResults / 25),
      };
    } catch {
      return {
        ok: false,
        err: 'Could not found restaurant',
      };
    }
  }
}
