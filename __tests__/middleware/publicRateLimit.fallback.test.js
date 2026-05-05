const publicRateLimitMiddleware = require("../../middleWare/publicRateLimitMiddleware");

const createReqRes = () => {
  const req = {
    method: "POST",
    baseUrl: "/api/public/v1/marketplace",
    route: { path: "/auth/token/refresh" },
    path: "/auth/token/refresh",
    headers: {},
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
    partnerCredential: null,
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const next = jest.fn();

  return { req, res, next };
};

describe("publicRateLimitMiddleware fallback", () => {
  test("rate-limits unauthenticated caller by IP for refresh route", () => {
    process.env.PUBLIC_API_FALLBACK_RATE_LIMIT_PER_MINUTE = "2";

    const first = createReqRes();
    publicRateLimitMiddleware(first.req, first.res, first.next);
    expect(first.next).toHaveBeenCalledTimes(1);

    const second = createReqRes();
    publicRateLimitMiddleware(second.req, second.res, second.next);
    expect(second.next).toHaveBeenCalledTimes(1);

    const third = createReqRes();
    publicRateLimitMiddleware(third.req, third.res, third.next);
    expect(third.res.status).toHaveBeenCalledWith(429);
    expect(third.res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Rate limit exceeded", limit: 2 }),
    );
  });
});
