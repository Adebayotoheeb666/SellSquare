import React, { useState } from "react";
import plusicon from "../../../assets/home/plusicon.svg";
import cupicon from "../../../assets/home/cup-icon.svg";
import { RxCrossCircled } from "react-icons/rx";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import cancelIcon from "../../../assets/home/cancel-menu.svg";
import {
  selectLoggedInBusinessOwner,
  selectUser,
} from "../../../redux/features/auth/authSlice";

export default function AddProductsBtn() {
  const admin = useSelector(selectLoggedInBusinessOwner);
  const currentUser = useSelector(selectUser);
  const [showAddProductOptions, setShowAddProductOptions] = useState(false);
  const handleSetModal = () => {
    setShowAddProductOptions(!showAddProductOptions);
  };

  const handleClickOutside = (e) => {
    if (e.target.classList.contains("add-product-options-header")) {
      handleSetModal();
    }
  };
 
  return (
    <div>
      <div>
        {showAddProductOptions && (
          <div className="add-product-options-header" onClick={handleClickOutside}>
            <div className="add-product-options-body" onClick={(e) => e.stopPropagation()}>
              <div className="header">
                <img
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSetModal()}
                  src={cancelIcon}
                  alt="cancel"
                />
              </div>
              <div className="body">
                <h1>Add product</h1>
                <div className="group-single">
                  <div className="single">
                    <p>Add a single Product</p>
                    <div className="images">
                      <img src={cupicon} alt="Single Product" />
                    </div>
                    <p>Create a single product</p>
                    <Link to="/add-product">
                      <button onClick={() => handleSetModal()}>Add Item</button>
                    </Link>
                  </div>
                  <div className="group">
                    <p>Add a single Product</p>
                    <div className="images">
                      <img
                        className="img1"
                        src={cupicon}
                        alt="multiple product"
                      />
                      <img
                        className="img2"
                        src={cupicon}
                        alt="multiple product"
                      />
                      <img
                        className="img3"
                        src={cupicon}
                        alt="multiple product"
                      />
                    </div>
                    <p>Create a multiple products</p>
                    <Link to="/add-product-group">
                      <button onClick={() => handleSetModal()}>
                        Add Item Group
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {admin || currentUser?.permissions?.addProducts ? (
        <button
          className="open_modal_products_btn"
          onClick={() => handleSetModal()}
        >
          <img src={plusicon} alt="plus" />
          Add New Product
        </button>
      ) : null}
    </div>
  );
}
