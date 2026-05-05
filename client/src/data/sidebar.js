import { FaTh, FaRegChartBar, FaCommentAlt } from "react-icons/fa";
import { BiImageAdd } from "react-icons/bi";

const menu = [
  {
    title: "Dashboard",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="2"
          y="2"
          width="5"
          height="5"
          rx="1.25"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
        />
        <rect
          x="9"
          y="2"
          width="5"
          height="5"
          rx="1.25"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
        />
        <rect
          x="2"
          y="9"
          width="5"
          height="5"
          rx="1.25"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
        />
        <rect
          x="9"
          y="9"
          width="5"
          height="5"
          rx="1.25"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
        />
      </svg>
    ),
    path: "/dashboard",
    count: false,
  },
  {
    title: "Inventory",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="2"
          y="3"
          width="14"
          height="12"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M2 7H16" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9 3V7" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M6 11.5H12"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    ),
    path: "/inventory",
    count: false,
    childrens: [
      {
        title: "Products",
        path: "/inventory",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="1"
              y="1"
              width="12"
              height="12"
              rx="1"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <line
              x1="1"
              y1="5"
              x2="13"
              y2="5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <line
              x1="5"
              y1="1"
              x2="5"
              y2="13"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        ),
      },
      {
        title: "Groups",
        path: "/inventory/product-groups",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="2"
              y="2"
              width="4"
              height="4"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <rect
              x="8"
              y="2"
              width="4"
              height="4"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <rect
              x="2"
              y="8"
              width="4"
              height="4"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <rect
              x="8"
              y="8"
              width="4"
              height="4"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        ),
      },
      {
        title: "Sales",
        path: "/inventory/sales",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polyline
              points="1,7 5,11 13,2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        ),
      },
      {
        title: "Out of Stock",
        path: "/inventory/out-of-stock",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="7"
              cy="7"
              r="6"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <line
              x1="3"
              y1="7"
              x2="11"
              y2="7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Marketplace",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2.5 5H13.5V12.5C13.5 12.7761 13.2761 13 13 13H3C2.72386 13 2.5 12.7761 2.5 12.5V5Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M2 5L3.5 2.5H12.5L14 5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 8.5H10"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
    path: "/marketplace",
    count: false,
    childrens: [
      {
        title: "Orders",
        path: "/marketplace/orders",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="2"
              y="2"
              width="10"
              height="10"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M4 5H10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M4 8H8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        title: "Discounts",
        path: "/marketplace/discounts",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="4"
              cy="4"
              r="1.2"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <circle
              cx="10"
              cy="10"
              r="1.2"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M10.5 3.5L3.5 10.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        title: "Wallet",
        path: "/marketplace/wallet",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="2"
              y="3"
              width="10"
              height="8"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M9 7H11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        title: "Setup",
        path: "/marketplace/setup",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M7 1.5V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M7 11V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M11 7H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M1.5 7H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Expenses",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="1.5"
          y="3"
          width="13"
          height="9.5"
          rx="1.8"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M1.5 7H14.5" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M6 10.5H10"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
    path: "/expenses",
    count: false,
  },
  {
    title: "Cart",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2.2 3H3.3L4.35 10.05C4.45 10.75 5.03 11.25 5.73 11.25H11.27C11.97 11.25 12.55 10.75 12.65 10.05L13.25 6.5H4.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="5.6"
          cy="13"
          r="0.9"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <circle
          cx="11.4"
          cy="13"
          r="0.9"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
    ),
    path: "/cart",
    count: true,
    countType: "cart",
  },
  {
    title: "Fulfilments",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="3"
          y="4"
          width="10"
          height="9"
          rx="1.6"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M6 2.5H10"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M6.5 6.5L8.5 8.7L11.5 5.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    path: "/fulfilments",
    count: true,
    countType: "fulfilment",
    childrens: [
      {
        title: "Pending",
        path: "/fulfilments",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="7"
              cy="7"
              r="5.5"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M7 4V7L9 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        title: "Cleared",
        path: "/fulfilments/cleared",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polyline
              points="2,7 5.5,10.5 12,3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Customers",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="5.3"
          cy="5.3"
          r="2.3"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <circle
          cx="11.2"
          cy="5.8"
          r="2.1"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path
          d="M1.8 12.2C1.8 10.9 2.9 9.8 4.2 9.8H6.2C7.5 9.8 8.6 10.9 8.6 12.2V13.2"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M9.2 12.3C9.2 11.1 10.2 10.1 11.4 10.1H12C13.3 10.1 14.3 11.1 14.3 12.3V13.2"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
    path: "/customers",
    count: false,
  },
  {
    title: "Activities",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
      >
        <path
          d="M14.7 8H12L10 14L6 2L4 8H1.3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    path: "/activities",
    count: false,
  },
  {
    title: "Account",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="8" cy="4.5" r="3" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M3 13C3 10.7909 4.79086 9 7 9H9C11.2091 9 13 10.7909 13 13"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
    path: "/accounts",
    count: false,
    childrens: [
      {
        title: "Business Profile",
        path: "/accounts/business-profile",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7 1C4.79086 1 3 2.79086 3 5C3 7.20914 4.79086 9 7 9C9.20914 9 11 7.20914 11 5C11 2.79086 9.20914 1 7 1Z"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M2 13C2 10.7909 4.23858 9 7 9C9.76142 9 12 10.7909 12 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        ),
      },
      {
        title: "Subscription",
        path: "/accounts/subscription",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="2"
              y="3"
              width="10"
              height="8"
              rx="1"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M4 3V2C4 1.44772 4.44772 1 5 1H9C9.55228 1 10 1.44772 10 2V3"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M7 7V9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        title: "Manage Stores",
        path: "/accounts/store",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 5L7 2L12 5V11C12 11.5523 11.5523 12 11 12H3C2.44772 12 2 11.5523 2 11V5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M5 12V7H9V12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        title: "Staff",
        path: "/accounts/sales",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="4"
              cy="4"
              r="2"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <circle
              cx="10"
              cy="4"
              r="2"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M1 12C1 10.3431 2.34315 9 4 9C5.65685 9 7 10.3431 7 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M7 12C7 10.3431 8.34315 9 10 9C11.6569 9 13 10.3431 13 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        ),
      },
      {
        title: "API Keys",
        path: "/accounts/api-keys",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8.8 2.2C10.3464 2.2 11.6 3.4536 11.6 5C11.6 6.5464 10.3464 7.8 8.8 7.8C7.2536 7.8 6 6.5464 6 5C6 3.4536 7.2536 2.2 8.8 2.2Z"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M1.2 7H6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M3.2 9V7"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M5 8.6V7"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
    ],
  },
];

export default menu;
