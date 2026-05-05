/**
 * Cursor-Based Pagination Utility
 *
 * Provides efficient cursor-based pagination for MongoDB collections.
 * Uses the _id field as the cursor by default, but supports custom cursor fields.
 *
 * Benefits over offset-based pagination:
 * - Consistent results even with concurrent inserts/deletes
 * - Better performance on large datasets (no skip operation)
 * - Ideal for infinite scroll and realtime data
 *
 * Usage:
 * const { paginate, buildCursorQuery, encodeCursor, decodeCursor } = require('./cursorPagination');
 *
 * // In controller:
 * const result = await paginate(Model, baseFilter, {
 *   cursor: req.query.cursor,
 *   limit: 10,
 *   sortField: 'createdAt',
 *   sortDirection: -1,
 * });
 */

const mongoose = require("mongoose");

/**
 * Encode cursor data to base64 string
 */
const encodeCursor = (cursorData) => {
  if (!cursorData) return null;
  try {
    const json = JSON.stringify(cursorData);
    return Buffer.from(json).toString("base64");
  } catch (error) {
    console.error("[CursorPagination] Error encoding cursor:", error);
    return null;
  }
};

/**
 * Decode base64 cursor string to cursor data
 */
const decodeCursor = (cursorString) => {
  if (!cursorString) return null;
  try {
    const json = Buffer.from(cursorString, "base64").toString("utf8");
    return JSON.parse(json);
  } catch (error) {
    console.error("[CursorPagination] Error decoding cursor:", error);
    return null;
  }
};

/**
 * Build cursor query condition for pagination
 *
 * @param {Object} cursorData - Decoded cursor data
 * @param {String} sortField - Field to sort by (default: '_id')
 * @param {Number} sortDirection - 1 for ascending, -1 for descending
 * @returns {Object} MongoDB query condition for cursor
 */
const buildCursorQuery = (
  cursorData,
  sortField = "_id",
  sortDirection = -1
) => {
  if (!cursorData) return {};

  const cursorValue = cursorData[sortField];
  if (!cursorValue) return {};

  // Convert string ObjectId to ObjectId for _id field
  const value =
    sortField === "_id" && typeof cursorValue === "string"
      ? new mongoose.Types.ObjectId(cursorValue)
      : cursorValue;

  // For descending order, get items less than cursor
  // For ascending order, get items greater than cursor
  const operator = sortDirection === -1 ? "$lt" : "$gt";

  return { [sortField]: { [operator]: value } };
};

/**
 * Build sort object for MongoDB query
 */
const buildSortObject = (sortField, sortDirection, secondaryField = "_id") => {
  const sort = { [sortField]: sortDirection };

  // Add secondary sort by _id for consistency when primary field has duplicates
  if (sortField !== "_id") {
    sort._id = sortDirection;
  }

  return sort;
};

/**
 * Extract cursor from document
 */
const extractCursor = (doc, sortField = "_id") => {
  if (!doc) return null;

  const cursorData = {
    _id: doc._id.toString(),
  };

  // Include sort field in cursor if different from _id
  if (sortField !== "_id" && doc[sortField] !== undefined) {
    cursorData[sortField] = doc[sortField];
  }

  return cursorData;
};

/**
 * Paginate MongoDB collection with cursor-based pagination
 *
 * @param {Model} Model - Mongoose model
 * @param {Object} baseFilter - Base filter conditions
 * @param {Object} options - Pagination options
 * @param {String} options.cursor - Encoded cursor string
 * @param {Number} options.limit - Number of items per page (default: 10)
 * @param {String} options.sortField - Field to sort by (default: 'createdAt')
 * @param {Number} options.sortDirection - 1 for asc, -1 for desc (default: -1)
 * @param {Array} options.select - Fields to select (optional)
 * @param {Array} options.populate - Population options (optional)
 * @returns {Object} Paginated result with data, cursors, and metadata
 */
const paginate = async (Model, baseFilter = {}, options = {}) => {
  const {
    cursor = null,
    limit = 10,
    sortField = "createdAt",
    sortDirection = -1,
    select = null,
    populate = null,
  } = options;

  // Decode cursor if provided
  const cursorData = decodeCursor(cursor);

  // Build cursor query
  const cursorQuery = buildCursorQuery(cursorData, sortField, sortDirection);

  // Combine base filter with cursor query
  const filter = {
    ...baseFilter,
    ...cursorQuery,
  };

  // Build sort object
  const sort = buildSortObject(sortField, sortDirection);

  // Fetch one extra item to determine if there are more pages
  const fetchLimit = limit + 1;

  // Build query
  let query = Model.find(filter).sort(sort).limit(fetchLimit);

  if (select) {
    query = query.select(select);
  }

  if (populate) {
    query = query.populate(populate);
  }

  // Execute query
  const items = await query.exec();

  // Check if there are more items
  const hasMore = items.length > limit;

  // Remove extra item if present
  if (hasMore) {
    items.pop();
  }

  // Get cursors for navigation
  const firstItem = items[0];
  const lastItem = items[items.length - 1];

  const nextCursor = hasMore
    ? encodeCursor(extractCursor(lastItem, sortField))
    : null;
  const prevCursor = cursorData
    ? encodeCursor(extractCursor(firstItem, sortField))
    : null;

  // Get total count (optional, can be expensive for large collections)
  // Consider caching this or computing it asynchronously
  const total = await Model.countDocuments(baseFilter);

  return {
    data: items,
    pagination: {
      nextCursor,
      prevCursor,
      hasMore,
      total,
      limit,
    },
    // For backwards compatibility with offset-based pagination
    currentPage: cursor ? null : 1,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Paginate with aggregate pipeline
 * Useful for complex queries with lookups, groupings, etc.
 */
const paginateAggregate = async (Model, pipeline = [], options = {}) => {
  const {
    cursor = null,
    limit = 10,
    sortField = "createdAt",
    sortDirection = -1,
  } = options;

  const cursorData = decodeCursor(cursor);
  const cursorQuery = buildCursorQuery(cursorData, sortField, sortDirection);

  // Add cursor match stage if cursor exists
  if (Object.keys(cursorQuery).length > 0) {
    pipeline.push({ $match: cursorQuery });
  }

  // Add sort stage
  pipeline.push({ $sort: buildSortObject(sortField, sortDirection) });

  // Add limit stage (fetch one extra)
  pipeline.push({ $limit: limit + 1 });

  // Execute aggregate
  const items = await Model.aggregate(pipeline);

  // Check for more items
  const hasMore = items.length > limit;
  if (hasMore) {
    items.pop();
  }

  // Build cursors
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore
    ? encodeCursor(extractCursor(lastItem, sortField))
    : null;

  return {
    data: items,
    pagination: {
      nextCursor,
      hasMore,
      limit,
    },
  };
};

/**
 * Create a cached cursor-based paginator
 * Maintains cursor state for a session
 */
class CursorPaginator {
  constructor(Model, baseFilter = {}, options = {}) {
    this.Model = Model;
    this.baseFilter = baseFilter;
    this.options = options;
    this.cursors = new Map(); // pageNumber -> cursor
    this.currentPage = 1;
  }

  async getPage(pageNumber = 1) {
    // Check if we have a cursor for this page
    let cursor = null;

    if (pageNumber > 1) {
      cursor = this.cursors.get(pageNumber);

      // If we don't have the cursor, we need to navigate from a known page
      if (!cursor && pageNumber > 1) {
        // Find the closest page we have a cursor for
        let closestPage = 1;
        for (const [page] of this.cursors) {
          if (page < pageNumber && page > closestPage) {
            closestPage = page;
          }
        }

        // Navigate from closest page to target page
        for (let p = closestPage; p < pageNumber; p++) {
          const result = await paginate(this.Model, this.baseFilter, {
            ...this.options,
            cursor: this.cursors.get(p),
          });

          if (result.pagination.nextCursor) {
            this.cursors.set(p + 1, result.pagination.nextCursor);
          }
        }

        cursor = this.cursors.get(pageNumber);
      }
    }

    const result = await paginate(this.Model, this.baseFilter, {
      ...this.options,
      cursor,
    });

    // Store cursor for next page
    if (result.pagination.nextCursor) {
      this.cursors.set(pageNumber + 1, result.pagination.nextCursor);
    }

    this.currentPage = pageNumber;

    return result;
  }

  reset() {
    this.cursors.clear();
    this.currentPage = 1;
  }
}

module.exports = {
  encodeCursor,
  decodeCursor,
  buildCursorQuery,
  buildSortObject,
  extractCursor,
  paginate,
  paginateAggregate,
  CursorPaginator,
};
