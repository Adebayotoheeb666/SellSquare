import React from "react";
import styles from "./Search.module.scss";

// Search Icon SVG Component
const SearchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="7"
      cy="7"
      r="5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11 11L15 15"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Search = ({ value, onChange }) => {
  return (
    <div className={styles.search}>
      <div className={styles.icon}>
        <SearchIcon />
      </div>
      <input
        type="text"
        placeholder="Search products"
        value={value}
        onChange={onChange}
      />
    </div>
  );
};

export default Search;
