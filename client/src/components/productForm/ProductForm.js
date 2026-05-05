import React, { useEffect, useState } from "react";
import "react-quill/dist/quill.snow.css";
import "./ProductForm.scss";
import { useSelector } from "react-redux";
import {
  selectLoggedInBusinessOwner,
  selectUser,
  selectConnectedStores,
  selectCurrentBusiness,
} from "../../redux/features/auth/authSlice";
import ButtonSpinner from "../loader/ButtonSpinner";
import usePaymentUpdate from "../../customHook/usePaymentUpdate";
import ExpiredSubscription from "../paymentUpdates/UpdatePayment";
import { getPrimaryImagePath } from "../../utils/productImageUtils";

const ProductForm = ({
  product,
  handleInputChange,
  saveProduct,
  handleImageChange,
  productImageItems,
  activeProductImageId,
  handleSelectProductImage,
  handleDeleteProductImage,
  mode,
  selectedBranches = [],
  onBranchChange,
  quantityDistribution = "same",
  onQuantityDistributionChange,
  branchQuantities = {},
  onBranchQuantityChange,
}) => {
  // const [imagePreview, setImagePreview] = useState(null); // State to store image preview
  const admin = useSelector(selectLoggedInBusinessOwner);
  const currentUser = useSelector(selectUser);
  const connectedStores = useSelector(selectConnectedStores);
  const currentBusiness = useSelector(selectCurrentBusiness);

  // Merge current business with connected stores
  const allAvailableStores = currentBusiness
    ? [currentBusiness, ...connectedStores.filter(store => store._id !== currentBusiness._id)]
    : connectedStores;
  const [showPopup, setShowPopup] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState(null); // "+" or "-"
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isInGracePeriod, isSubscriptionExpired } = usePaymentUpdate({
    currentUser: currentUser,
  });

  const onImageChange = (e) => {
    if ((e.target.files || []).length > 0) {
      handleImageChange(e);
    }
  };

  const selectedItems = Array.isArray(productImageItems)
    ? productImageItems
    : [];
  const activeItem =
    selectedItems.find((item) => item.id === activeProductImageId) ||
    selectedItems[selectedItems.length - 1] ||
    null;
  const activePreviewPath =
    activeItem?.previewUrl ||
    activeItem?.image?.filePath ||
    getPrimaryImagePath(product?.images, product?.image);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double submission

    setIsSubmitting(true);
    try {
      await saveProduct(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // console.log("ProductForm -> product", product);

  const openPopup = (type) => {
    setAdjustmentType(type);
    setShowPopup(true);
  };

  const closePopup = () => {
    setShowPopup(false);
    setAdjustmentValue("");
  };

  const applyQuantityChange = () => {
    const parsedValue = parseInt(adjustmentValue, 10);
    if (!isNaN(parsedValue) && parsedValue > 0) {
      const newQuantity =
        adjustmentType === "+"
          ? product.quantity + parsedValue
          : Math.max(0, product.quantity - parsedValue); // Prevent negative quantity

      handleInputChange({
        target: { name: "quantity", value: newQuantity },
      });

      closePopup();
    }
  };

  return (
    <>
      {admin || currentUser?.permissions?.addProducts ? (
        <>
          {isSubscriptionExpired ? (
            <>
              <ExpiredSubscription isBusinessOwner={admin} />
            </>
          ) : (
            <>
              <div className="product-group">
                <h1>
                  {mode === "add" ? "Add a Single Item" : "Edit Single Item"}
                </h1>
                <div className="product-form-group">
                  <form onSubmit={handleSubmit} encType="multipart/form-data">
                    <div className="form-field image-upload-section single-products">
                      <div
                        className="image-upload-container"
                        onClick={() =>
                          document.getElementById("imageUpload").click()
                        }
                      >
                        {activePreviewPath ? (
                          <img
                            src={activePreviewPath}
                            alt="Selected Preview"
                            className="selected-image"
                          />
                        ) : (
                          <span className="placeholder-text">
                            Upload the picture of your product
                          </span>
                        )}
                      </div>
                      <input
                        id="imageUpload"
                        type="file"
                        name="image"
                        accept="image/*"
                        multiple
                        onChange={onImageChange}
                        style={{ display: "none" }}
                      />
                      {!!selectedItems.length && (
                        <div className="image-gallery-strip">
                          <div className="image-gallery-thumbs">
                            {selectedItems.map((item) => {
                              const thumbSrc =
                                item.previewUrl || item.image?.filePath || "";

                              if (!thumbSrc) return null;

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  className={`image-thumb-btn ${
                                    item.id === activeItem?.id ? "active" : ""
                                  }`}
                                  onClick={() =>
                                    handleSelectProductImage(item.id)
                                  }
                                >
                                  <img src={thumbSrc} alt="Product thumbnail" />
                                  <span
                                    className="image-thumb-delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteProductImage(item.id);
                                    }}
                                  >
                                    ×
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            className="add-more-images-btn"
                            onClick={() =>
                              document.getElementById("imageUpload").click()
                            }
                          >
                            Add more
                          </button>
                        </div>
                      )}
                    </div>

                    {/* The rest of the form fields */}
                    <div className="form-field">
                      <div>
                        <label>Item name*</label>
                        <input
                          type="text"
                          name="name"
                          value={product?.name ?? ""}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div>
                        <label>Category*</label>
                        <input
                          type="text"
                          name="category"
                          value={product?.category ?? ""}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                    <div className="form-field">
                      <div>
                        <label>Cost Price*</label>
                        <input
                          type="text"
                          name="cost"
                          value={product?.cost ?? ""}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div>
                        <label>Selling Price*</label>
                        <input
                          type="text"
                          name="price"
                          value={product?.price ?? ""}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                    <div className="form-field">
                      {/* <div>
                        <label>Quantity*</label>
                        <input
                          type="text"
                          name="quantity"
                          value={product?.quantity}
                          onChange={handleInputChange}
                        />
                      </div> */}
                      <div>
                        <label>Quantity*</label>
                        {mode === "edit" ? (
                          <div className="quantity-container">
                            <button
                              type="button"
                              onClick={() => openPopup("-")}
                            >
                              -
                            </button>
                            <input
                              type="text"
                              name="quantity"
                              value={product?.quantity ?? ""}
                              onChange={handleInputChange}
                              // readOnly
                            />
                            <button
                              type="button"
                              onClick={() => openPopup("+")}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <input
                            type="text"
                            name="quantity"
                            value={product?.quantity ?? ""}
                            onChange={handleInputChange}
                          />
                        )}
                      </div>
                      <div>
                        <label>Warehouse*</label>
                        <input
                          type="text"
                          name="warehouse"
                          value={product?.warehouse ?? ""}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    <div className="form-field single-field">
                      <div>
                        <label>Description*</label>
                        <textarea
                          onChange={handleInputChange}
                          name="description"
                          value={product?.description ?? ""}
                          cols="30"
                          rows="4"
                        ></textarea>
                      </div>
                    </div>

                    {/* Branch Selection Section */}
                    {mode === "add" && allAvailableStores && allAvailableStores.length > 0 && (
                      <div className="branch-selection-section">
                        <h3>Select Branch(es)</h3>
                        <p className="branch-help-text">Choose which branch(es) this product should be added to</p>

                        <div className="branch-checkboxes">
                          {allAvailableStores.map((branch) => (
                            <label key={branch._id} className="branch-checkbox-label">
                              <input
                                type="checkbox"
                                checked={selectedBranches.includes(branch._id)}
                                onChange={(e) => {
                                  if (onBranchChange) {
                                    onBranchChange(branch._id, e.target.checked);
                                  }
                                }}
                                className="branch-checkbox"
                              />
                              <span className="branch-name">
                                {branch.businessName}
                              </span>
                            </label>
                          ))}
                        </div>

                        {selectedBranches.length > 1 && (
                          <div className="quantity-distribution-section">
                            <h4>Quantity Distribution</h4>
                            <p className="distribution-help-text">Choose how to distribute the quantity across selected branches</p>

                            <div className="distribution-options">
                              <label className="distribution-radio-label">
                                <input
                                  type="radio"
                                  name="quantityDistribution"
                                  value="same"
                                  checked={quantityDistribution === "same"}
                                  onChange={(e) => {
                                    if (onQuantityDistributionChange) {
                                      onQuantityDistributionChange(e.target.value);
                                    }
                                  }}
                                  className="distribution-radio"
                                />
                                <span className="radio-label-text">
                                  Same Quantity for All Branches
                                </span>
                              </label>
                              <p className="radio-description">All branches will get the total quantity</p>

                              <label className="distribution-radio-label">
                                <input
                                  type="radio"
                                  name="quantityDistribution"
                                  value="split"
                                  checked={quantityDistribution === "split"}
                                  onChange={(e) => {
                                    if (onQuantityDistributionChange) {
                                      onQuantityDistributionChange(e.target.value);
                                    }
                                  }}
                                  className="distribution-radio"
                                />
                                <span className="radio-label-text">
                                  Split Quantity Across Branches
                                </span>
                              </label>
                              <p className="radio-description">Each branch will get an equal portion</p>
                            </div>

                            {quantityDistribution === "split" && (
                              <div className="branch-quantities-section">
                                <h5>Quantity per Branch</h5>
                                <div className="quantity-inputs">
                                  {selectedBranches.map((branchId) => {
                                    const branch = allAvailableStores.find(b => b._id === branchId);
                                    const totalQty = parseInt(product?.quantity || 0, 10);
                                    const branchQty = branchQuantities[branchId] || Math.floor(totalQty / selectedBranches.length);

                                    return (
                                      <div key={branchId} className="branch-quantity-input">
                                        <label>{branch?.businessName}</label>
                                        <input
                                          type="number"
                                          min="0"
                                          value={branchQty}
                                          onChange={(e) => {
                                            if (onBranchQuantityChange) {
                                              onBranchQuantityChange(branchId, parseInt(e.target.value, 10) || 0);
                                            }
                                          }}
                                          className="quantity-input"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="submit-product-group">
                      <button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <ButtonSpinner />}
                        {mode === "add" ? "Add Product" : "Edit Product"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </>
          )}
          {showPopup && (
            <div className={`popup-overlay ${showPopup ? "show" : ""}`}>
              <div className="popup-content">
                <h3>
                  {adjustmentType === "+" ? "Add Quantity" : "Remove Quantity"}
                </h3>
                <input
                  type="number"
                  value={adjustmentValue}
                  onChange={(e) => setAdjustmentValue(e.target.value)}
                  min="1"
                />
                <div className="popup-buttons">
                  <button onClick={applyQuantityChange}>Confirm</button>
                  <button onClick={closePopup}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="unauthorized-containers">
          <h1>Unauthorized</h1>
        </div>
      )}
    </>
  );
};

export default ProductForm;
