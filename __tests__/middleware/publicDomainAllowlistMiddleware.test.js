const publicDomainAllowlistMiddleware = require("../../middleWare/publicDomainAllowlistMiddleware");
const {
  mockRequest,
  mockResponse,
  mockNext,
} = require("../helpers/testHelpers");

describe("publicDomainAllowlistMiddleware", () => {
  const buildReq = ({ headers = {}, allowlistedDomains = [] } = {}) => {
    const req = mockRequest();

    req.headers = Object.entries(headers).reduce((acc, [key, value]) => {
      acc[String(key).toLowerCase()] = value;
      return acc;
    }, {});

    req.get = (name) => req.headers[String(name || "").toLowerCase()] || "";
    req.partnerCredential = {
      allowlistedDomains,
    };

    return req;
  };

  it("allows request when origin matches allowlisted production domain", () => {
    const req = buildReq({
      headers: {
        origin: "https://www.sellsquarehub.com",
        host: "api.sellsquarehub.com",
      },
      allowlistedDomains: [{ domain: "sellsquarehub.com", isActive: true }],
    });
    const res = mockResponse();
    const next = mockNext();

    publicDomainAllowlistMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("does not block proxy/server requests when only host headers are present", () => {
    const req = buildReq({
      headers: {
        host: "api.sellsquarehub.com",
        "x-forwarded-host": "api.sellsquarehub.com",
      },
      allowlistedDomains: [{ domain: "partner.example.com", isActive: true }],
    });
    const res = mockResponse();
    const next = mockNext();

    publicDomainAllowlistMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects request when caller origin does not match allowlist", () => {
    const req = buildReq({
      headers: {
        origin: "https://evil.example.net",
        host: "api.sellsquarehub.com",
      },
      allowlistedDomains: [{ domain: "sellsquarehub.com", isActive: true }],
    });
    const res = mockResponse();
    const next = mockNext();

    publicDomainAllowlistMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Request domain is not allowlisted for this credential",
        domain: "evil.example.net",
      }),
    );
  });
});
