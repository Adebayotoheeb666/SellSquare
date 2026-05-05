import * as authService from "../services/authService";
import axios from "axios";

jest.mock("axios");
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("Auth Service", () => {
  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe("loginUser", () => {
    it("should login user successfully", async () => {
      const mockResponse = {
        data: {
          token: "test-token",
          user: {
            _id: "user123",
            businessEmail: "test@business.com",
          },
        },
        statusText: "OK",
      };

      axios.post.mockResolvedValue(mockResponse);

      const credentials = {
        businessEmail: "test@business.com",
        password: "TestPass123!",
      };

      const result = await authService.loginUser(credentials);

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/login"),
        credentials,
        { withCredentials: true },
      );
      expect(result).toEqual(mockResponse.data);
      expect(localStorage.getItem("accessToken")).toBe("test-token");
    });

    it("should handle login error", async () => {
      const mockError = {
        response: {
          data: { message: "Invalid credentials" },
        },
      };

      axios.post.mockRejectedValue(mockError);

      const result = await authService.loginUser({
        businessEmail: "wrong@email.com",
        password: "wrongpass",
      });

      expect(result).toBeUndefined();
    });
  });

  describe("getLoginStatus", () => {
    it("should return true when user is logged in", async () => {
      localStorage.setItem("accessToken", "test-token");

      const status = await authService.getLoginStatus();

      expect(status).toBe(true);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("should return false when user is not logged in", async () => {
      localStorage.removeItem("accessToken");

      const status = await authService.getLoginStatus();

      expect(status).toBe(false);
    });
  });

  describe("logoutUser", () => {
    it("should logout user successfully", async () => {
      localStorage.setItem("accessToken", "test-token");
      axios.get.mockResolvedValue({ data: { message: "Logout successful" } });

      await authService.logoutUser();

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining("/logout")
      );
      expect(localStorage.getItem("accessToken")).toBeNull();
    });
  });
});
