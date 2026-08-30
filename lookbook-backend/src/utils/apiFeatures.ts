import type { Query } from "mongoose";

interface BookQueryParams {
  search?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: string;
  limit?: string;
}

const sortMap: Record<string, string> = {
  popular: "-reviewsCount",
  "price-asc": "rentPrice",
  "price-desc": "-rentPrice",
  rating: "-rating",
  newest: "-createdAt",
};

export class ApiFeatures<T> {
  query: Query<T[], T>;
  queryParams: BookQueryParams;
  totalCountQuery: Query<T[], T>;

  constructor(query: Query<T[], T>, queryParams: BookQueryParams) {
    this.query = query;
    this.queryParams = queryParams;
    this.totalCountQuery = query.clone();
  }

  filter() {
    const { category, minPrice, maxPrice } = this.queryParams;
    const filters: Record<string, unknown> = {};

    if (category && category !== "All") {
      filters.category = category;
    }

    if (minPrice || maxPrice) {
      filters.rentPrice = {
        ...(minPrice ? { $gte: Number(minPrice) } : {}),
        ...(maxPrice ? { $lte: Number(maxPrice) } : {}),
      };
    }

    this.query = this.query.find(filters);
    this.totalCountQuery = this.totalCountQuery.find(filters);
    return this;
  }

  search() {
    const { search } = this.queryParams;
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      const condition = { $or: [{ title: regex }, { author: regex }, { tags: regex }] };
      this.query = this.query.find(condition);
      this.totalCountQuery = this.totalCountQuery.find(condition);
    }
    return this;
  }

  sort() {
    const sortKey = this.queryParams.sort ?? "popular";
    this.query = this.query.sort(sortMap[sortKey] ?? sortMap.popular);
    return this;
  }

  paginate() {
    const page = Math.max(Number(this.queryParams.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(this.queryParams.limit ?? 12), 1), 50);
    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);
    return this;
  }

  async countTotal() {
    return this.totalCountQuery.clone().countDocuments();
  }
}
