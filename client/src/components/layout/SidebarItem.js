import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

const activeLink = ({ isActive }) => (isActive ? "active-link" : "link");

// Custom Arrow Icons
const ArrowDownIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 6L8 10L12 6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ArrowUpIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 10L8 6L12 10"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SidebarItem = ({ item, isOpen, count, handleShowMenu, count2 }) => {
  const location = useLocation();
  const hasChildren = item.childrens && item.childrens.length > 0;

  // Check if any child is active
  const isChildActive =
    hasChildren &&
    item.childrens.some((child) => location.pathname === child.path);

  // Auto-expand if any child is active
  const [expandSubMenu, setExpandSubMenu] = useState(isChildActive);

  // Update expandSubMenu when route changes
  React.useEffect(() => {
    if (isChildActive) {
      setExpandSubMenu(true);
    }
  }, [isChildActive]);

  const handleParentClick = (e) => {
    if (hasChildren) {
      e.preventDefault();
      setExpandSubMenu(!expandSubMenu);
    }
  };

  if (hasChildren) {
    return (
      <div className="sidebar-item-with-children">
        <div
          className={`sidebar-item s-parent ${
            isChildActive ? "active-link" : ""
          }`}
          onClick={handleParentClick}
        >
          {" "}
          <div className="sidebar-title">
            <span>
              {item.icon && <div className="icon">{item.icon}</div>}
              <div className="title">{item.title}</div>
              <div className="submenu-arrow">
                {expandSubMenu ? <ArrowDownIcon /> : <ArrowUpIcon />}
              </div>
            </span>
          </div>
        </div>
        {expandSubMenu && (
          <div className="sidebar-submenu">
            {item.childrens.map((child, index) => (
              <NavLink
                key={index}
                to={child.path}
                end={true}
                className={activeLink}
                onClick={handleShowMenu}
              >
                <div className="sidebar-subitem">
                  {child.icon && (
                    <div className="subitem-icon">{child.icon}</div>
                  )}
                  <div className="title">{child.title}</div>
                </div>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink to={item.path} className={activeLink}>
      <div className="sidebar-item s-parent">
        <div className="sidebar-title">
          {item.count ? (
            <div>
              {item.countType === "cart" ? (
                <span onClick={() => handleShowMenu()}>
                  {item.icon && <div className="icon">{item.icon}</div>}
                  <div className="title">{item.title}</div>
                  <div className="cart-count">{count}</div>
                </span>
              ) : (
                <span onClick={() => handleShowMenu()}>
                  {item.icon && <div className="icon">{item.icon}</div>}
                  <div className="title">{item.title}</div>
                  <div className="cart-count">{count2}</div>
                </span>
              )}
            </div>
          ) : (
            <div>
              <span onClick={() => handleShowMenu()}>
                {item.icon && <div className="icon">{item.icon}</div>}
                <div className="title">{item.title}</div>
              </span>
            </div>
          )}
        </div>
      </div>
    </NavLink>
  );
};

export default SidebarItem;
