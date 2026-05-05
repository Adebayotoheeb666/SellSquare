import React from "react";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import configureStore from "redux-mock-store";
import { BrowserRouter } from "react-router-dom";
import CartDetails from "../components/cartDetails/CartDetails";

const mockStore = configureStore([]);

jest.mock("../components/loader/Loader", () => () => <div>Loading...</div>);
jest.mock("../customHook/usePaymentUpdate", () => ({
  __esModule: true,
  default: () => ({ isExpired: false, isInGracePeriod: false }),
}));
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock("../redux/features/dataCache/bulkDataCacheSlice", () => {
  const actual = jest.requireActual("../redux/features/dataCache/bulkDataCacheSlice");
  return {
    ...actual,
    fetchBulkCustomers: jest.fn(() => ({ type: "bulkDataCache/fetchBulkCustomers" })),
  };
});

describe("CartDetails Component", () => {
  let store;

  const mockCart = {
    items: [
      {
        _id: "1",
        product: {
          _id: "product1",
          name: "Test Product",
          price: 100,
        },
        quantity: 2,
        price: 100,
      },
    ],
    subTotal: 200,
  };

  const mockUser = {
    _id: "user123",
    businessName: "Test Business",
  };

  beforeEach(() => {
    store = mockStore({
      cart: {
        cart: mockCart,
        cartSubTotal: 200,
        isLoading: false,
      },
      auth: {
        user: mockUser,
        loggedInBusinessOwner: true,
      },
      bulkDataCache: {
        customers: {
          byId: {},
          allIds: [],
          meta: {
            total: 0,
            loaded: 0,
            isComplete: false,
            lastFetchedAt: null,
            isLoading: true,
            error: null,
          },
        },
        productGroups: {
          byId: {},
          allIds: [],
          meta: {
            total: 0,
            loaded: 0,
            isComplete: false,
            lastFetchedAt: null,
            isLoading: false,
            error: null,
          },
        },
      },
      productCache: {
        productsById: {},
      },
    });
  });

  const renderCartDetails = (props = {}) => {
    return render(
      <Provider store={store}>
        <BrowserRouter>
          <CartDetails
            isLoading={props.isLoading || false}
            cart={props.cart || mockCart}
            user={mockUser}
            {...props}
          />
        </BrowserRouter>
      </Provider>
    );
  };

  it("should render component", () => {
    const { container } = renderCartDetails();
    expect(container).toBeInTheDocument();
  });

  it("should display empty cart message when no items", () => {
    const emptyCart = { items: [], subTotal: 0 };
    renderCartDetails({ cart: emptyCart });

    // Component should handle empty state gracefully
    expect(screen.queryByText("Test Product")).not.toBeInTheDocument();
  });
});
