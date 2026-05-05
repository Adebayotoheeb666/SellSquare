import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import configureStore from "redux-mock-store";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MarketplaceOrderDetail from "../pages/product/marketplace/OrderDetail";

jest.mock("../services/marketplaceService", () => ({
  getMarketplaceOrder: jest.fn(),
  confirmMarketplacePayment: jest.fn(),
  decideMarketplaceOrderLines: jest.fn(),
  updateMarketplaceOrderStatus: jest.fn(),
}));

import marketplaceService from "../services/marketplaceService";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockStore = configureStore([]);

const createStateWithOrder = (order) => ({
  bulkDataCache: {
    marketplaceOrders: {
      byId: {
        [order._id]: order,
      },
      allIds: [order._id],
      meta: {},
    },
  },
});

const renderOrderDetail = (order) => {
  const store = mockStore(createStateWithOrder(order));

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/marketplace/orders/${order._id}`]}>
        <Routes>
          <Route
            path="/marketplace/orders/:orderId"
            element={<MarketplaceOrderDetail />}
          />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
};

describe("MarketplaceOrderDetail metadata rendering", () => {
  test("renders fulfillment/address/contact chips and prefers persisted line image metadata", () => {
    const order = {
      _id: "order_meta_1",
      orderNumber: "MKT-DEM-123456",
      partnerOrderRef: "NINO-001",
      createdAt: "2026-03-04T10:00:00.000Z",
      status: "placed",
      customer: {
        name: "Buyer One",
        email: "buyer@example.com",
        phone: "+2348000000000",
        address: "Legacy Address",
      },
      shippingAddress: {
        addressLine1: "12 Market Street",
        city: "Lagos",
        country: "NG",
      },
      fulfillment: {
        method: "delivery",
      },
      payment: { isPaid: false, paymentId: "" },
      lines: [
        {
          lineId: "line_1",
          name: "Sample Item",
          sku: "SKU-1",
          requestedQty: 2,
          acceptedQty: 0,
          rejectedQty: 0,
          lineStatus: "pending",
          selectedImage: "https://cdn.example.com/selected.jpg",
          productSnapshot: {
            image: "https://cdn.example.com/fallback.jpg",
          },
        },
      ],
      statusHistory: [],
      warnings: [],
    };

    renderOrderDetail(order);

    expect(screen.getByText("Fulfillment: Delivery")).toBeInTheDocument();
    expect(
      screen.getByText("Address: 12 Market Street, Lagos, NG"),
    ).toBeInTheDocument();
    expect(screen.getByText("Phone: +2348000000000")).toBeInTheDocument();
    expect(screen.getByText("Email: buyer@example.com")).toBeInTheDocument();

    const image = screen.getByAltText("Sample Item");
    expect(image).toHaveAttribute("src", "https://cdn.example.com/selected.jpg");
  });

  test("gracefully renders when optional metadata is missing", () => {
    const order = {
      _id: "order_meta_2",
      orderNumber: "MKT-DEM-654321",
      createdAt: "2026-03-04T10:00:00.000Z",
      status: "placed",
      customer: {
        name: "Buyer Two",
        email: "",
        phone: "",
        address: "",
      },
      payment: { isPaid: false, paymentId: "" },
      lines: [
        {
          lineId: "line_2",
          name: "No Meta Item",
          sku: "SKU-2",
          requestedQty: 1,
          acceptedQty: 0,
          rejectedQty: 0,
          lineStatus: "pending",
        },
      ],
      statusHistory: [],
      warnings: [],
    };

    renderOrderDetail(order);

    expect(screen.getByText("Order Lines")).toBeInTheDocument();
    expect(screen.getByText("Fulfillment: -")).toBeInTheDocument();
    expect(screen.getByText("No Meta Item")).toBeInTheDocument();
  });

  test("manual refresh refetches only current order", async () => {
    const order = {
      _id: "order_meta_3",
      orderNumber: "MKT-DEM-333333",
      createdAt: "2026-03-04T10:00:00.000Z",
      status: "placed",
      customer: {
        name: "Buyer Three",
        email: "buyer3@example.com",
        phone: "+2348000000003",
      },
      payment: { isPaid: false, paymentId: "" },
      lines: [
        {
          lineId: "line_3",
          name: "Refreshable Item",
          sku: "SKU-3",
          requestedQty: 1,
          acceptedQty: 0,
          rejectedQty: 0,
          lineStatus: "pending",
        },
      ],
      statusHistory: [],
      warnings: [],
    };

    marketplaceService.getMarketplaceOrder.mockResolvedValueOnce({ order });

    const store = mockStore(createStateWithOrder(order));

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[`/marketplace/orders/${order._id}`]}>
          <Routes>
            <Route
              path="/marketplace/orders/:orderId"
              element={<MarketplaceOrderDetail />}
            />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(marketplaceService.getMarketplaceOrder).toHaveBeenCalledWith(
        "order_meta_3",
      );
    });

  });
});
