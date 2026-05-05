import plusadd from "../../assets/home/plusadd.svg";
import crox from "../../assets/home/crox.svg";
import deleteIcon from "../../assets/home/deleteIcon.svg";
import { RxCrossCircled } from "react-icons/rx";
import Loader from "../../components/loader/Loader";
import ButtonSpinner from "../../components/loader/ButtonSpinner";
import "./addproduct.css";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import usePaymentUpdate from "../../customHook/usePaymentUpdate";
import { toast } from "sonner";
import ExpiredSubscription from "../paymentUpdates/UpdatePayment";
import { getPrimaryImagePath } from "../../utils/productImageUtils";

export default function ProductGroupForm({
  mode,
  isLoading,
  admin,
  currentUser,
  formData,
  attributes,
  combinations,
  sku,
  price,
  warehouse,
  cost,
  options,
  quantity,
  inputRefs,
  handleInputChange,
  handleBlur,
  handleKeyPress,
  handleAddAttribute,
  handleDeleteAttribute,
  handleRemoveItem,
  handleDeleteCombination,
  handleSetCombinationName,
  handleSkuChange,
  handlePriceChange,
  handleCostChange,
  handleWarehouseChange,
  handleQuantityChange,
  handleCopySkuToAll,
  handleCopyCostToAll,
  handleCopyPriceToAll,
  handleCopyWarehouseToAll,
  handleCopyQuantityToAll,
  saveProductGroup,
  focusInput,
  handleImageChange,
  handleSelectGroupImage,
  handleDeleteGroupImage,
  handleCombinationImageChange,
  groupImageItems,
  activeGroupImageId,
  combinationImagePreviews,
  selectedBranches = [],
  onBranchChange,
  quantityDistribution = "same",
  onQuantityDistributionChange,
  branchQuantities = {},
  onBranchQuantityChange,
  allAvailableStores = [],
}) {
  const isAuthorized =
    mode === "add"
      ? admin || currentUser?.permissions?.addProducts
      : admin || currentUser?.permissions?.editproducts;

  const { isInGracePeriod, isSubscriptionExpired } = usePaymentUpdate({
    currentUser: currentUser,
  });
  // console.log("checked value", formData.isProductUnique);

  const [showModal, setShowModal] = useState(false);
  const [isCheckboxChecked, setIsCheckboxChecked] = useState(
    formData.isProductUnique
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [quantityModal, setQuantityModal] = useState({
    show: false,
    index: null,
    action: null,
  }); // New state to manage the quantity modal visibility and action (add/subtract)
  const [quantityChange, setQuantityChange] = useState(""); // New state to manage the input value in the quantity modal

  useEffect(() => {
    setIsCheckboxChecked(formData.isProductUnique);
  }, [formData.isProductUnique]);

  const handleCheckboxChange = () => {
    setShowModal(true);
  };

  const handleConfirm = () => {
    setIsCheckboxChecked(!isCheckboxChecked);
    handleInputChange({
      target: {
        name: "isProductUnique",
        value: !isCheckboxChecked,
      },
    });
    setShowModal(false);
  };

  const handleCancel = () => {
    setShowModal(false);
  };

  const onImageChange = (e) => {
    if ((e.target.files || []).length > 0) {
      handleImageChange(e);
    }
  };

  const topImageItems = Array.isArray(groupImageItems) ? groupImageItems : [];
  const activeTopImage =
    topImageItems.find((item) => item.id === activeGroupImageId) ||
    topImageItems[topImageItems.length - 1] ||
    null;
  const activeTopImagePath =
    activeTopImage?.previewUrl ||
    activeTopImage?.image?.filePath ||
    getPrimaryImagePath(formData?.images, formData?.image);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await saveProductGroup(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuantityModalOpen = (index, action) => {
    setQuantityModal({ show: true, index, action }); // Open the quantity modal with the specified action (add/subtract) and index
  };

  const handleQuantityModalClose = () => {
    setQuantityModal({ show: false, index: null, action: null }); // Close the quantity modal
    setQuantityChange(""); // Reset the quantity change input value
  };

  const handleQuantityChangeConfirm = () => {
    if (!isNaN(quantityChange)) {
      const newQuantity =
        parseInt(quantity[quantityModal.index] || 0, 10) +
        (quantityModal.action === "add"
          ? parseInt(quantityChange, 10)
          : -parseInt(quantityChange, 10)); // Calculate the new quantity based on the action
      handleQuantityChange(
        {
          target: {
            name: "quantity",
            value: newQuantity,
          },
        },
        quantityModal.index
      ); // Update the quantity for the specified index
    }
    handleQuantityModalClose(); // Close the quantity modal
  };

  return (
    <>
      <Modal
        show={showModal}
        message="Changing this setting will reset sku, quantity, cost price, selling price and warehouse for all items. Are you sure you want to proceed?"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        currentUser={currentUser}
      />
      <QuantityModal
        show={quantityModal.show}
        onCancel={handleQuantityModalClose}
        onConfirm={handleQuantityChangeConfirm}
        quantityChange={quantityChange}
        setQuantityChange={setQuantityChange}
        action={quantityModal.action}
      />
      {isAuthorized ? (
        <>
          {isSubscriptionExpired ? (
            <>
              <ExpiredSubscription isBusinessOwner={admin} />
            </>
          ) : (
            <>
              <form onSubmit={handleSubmit} encType="multipart/form-data">
                <div className="product-group">
                  {/* Loader removed - using toast notifications instead */}
                  <h1>
                    {mode === "add" ? "Add Item Group" : "Edit Item Group"}
                  </h1>

                  <div className="form-field image-upload-section">
                    <div
                      className="image-upload-container"
                      onClick={() =>
                        document.getElementById("imageUpload").click()
                      }
                    >
                      {activeTopImagePath ? (
                        <img
                          src={activeTopImagePath}
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
                    {!!topImageItems.length && (
                      <div className="image-gallery-strip top-group-gallery">
                        <div className="image-gallery-thumbs">
                          {topImageItems.map((item) => {
                            const thumbSrc =
                              item.previewUrl || item.image?.filePath || "";
                            if (!thumbSrc) return null;

                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`image-thumb-btn ${
                                  item.id === activeTopImage?.id ? "active" : ""
                                }`}
                                onClick={() => handleSelectGroupImage(item.id)}
                              >
                                <img src={thumbSrc} alt="Group thumbnail" />
                                <span
                                  className="image-thumb-delete"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteGroupImage(item.id);
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

                  <div className="product-form-group">
                    <div className="form-field">
                      <div>
                        <label>Item Group Name*</label>
                        <input
                          name="groupName"
                          onChange={handleInputChange}
                          type="text"
                          value={formData.groupName}
                        />
                      </div>
                      <div>
                        <label>Category*</label>
                        <input
                          name="category"
                          onChange={handleInputChange}
                          type="text"
                          value={formData.category}
                        />
                      </div>
                    </div>
                    <div className="form-field single-field">
                      <div>
                        <label>Description*</label>
                        <textarea
                          onChange={handleInputChange}
                          name="description"
                          value={formData.description}
                          cols="30"
                          rows="4"
                        ></textarea>
                      </div>
                    </div>

                    {/* Branch Selection Section */}
                    {mode === "add" && allAvailableStores && allAvailableStores.length > 0 && (
                      <div className="branch-selection-section">
                        <h3>Select Branch(es)</h3>
                        <p className="branch-help-text">Choose which branch(es) this product group should be added to</p>

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
                                    const totalQty = parseInt(quantity[0] || 0, 10);
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

                    <div className="check_unique">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={isCheckboxChecked}
                          onChange={handleCheckboxChange}
                          name="isProductUnique"
                        />
                        <span className="checkmark"></span>
                      </label>
                      <p>Each item has unique attribute</p>
                    </div>

                    {attributes.map((attr, index) => (
                      <div
                        key={index}
                        className="form-field product_group_attributes"
                      >
                        <div>
                          <label>Attribute*</label>
                          <input
                            name={`attribute_${index}`}
                            value={attr}
                            onChange={(e) => handleBlur(e, index)}
                            type="text"
                          />
                        </div>
                        <div>
                          <label>Options*</label>
                          <div
                            onClick={() => focusInput(inputRefs.current[index])}
                            className="options"
                          >
                            <ul>
                              {options[index]?.attr.map((option, index2) => (
                                <li key={index2}>
                                  {!option.showInput && (
                                    <span>
                                      {option.value}
                                      <img
                                        onClick={() =>
                                          handleRemoveItem(index, index2)
                                        }
                                        src={crox}
                                        alt="cancel"
                                      />
                                    </span>
                                  )}
                                </li>
                              ))}
                              {options[index]?.attr.some(
                                (option) => option.showInput
                              ) && (
                                  <input
                                    ref={inputRefs.current[index]}
                                    type="text"
                                    onKeyDown={(e) => handleKeyPress(e, index)}
                                    inputMode="text"
                                    pattern="[A-Za-z0-9,]*"
                                  />
                                )}
                            </ul>
                          </div>
                        </div>
                        <img
                          src={deleteIcon}
                          onClick={() => handleDeleteAttribute(index)}
                          alt="delete"
                        />
                      </div>
                    ))}

                    <div className="product_group_instructions">
                      <ul>
                        <li>
                          Avoid using "-" or "/" as they are used for
                          combination.
                        </li>
                        <li>Separate different options by pressing enter.</li>
                        <li>
                          If you have more than one attributes:{" "}
                          <ul>
                            <li>
                              Every first option in the previous attribute
                            </li>
                            <li>
                              Matches every first option in the second option
                              and so on.
                            </li>
                            <li>
                              As you may be able to figure in the item name
                              generated.
                            </li>
                          </ul>
                        </li>
                      </ul>
                    </div>

                    <span onClick={handleAddAttribute}>
                      <img src={plusadd} alt="add" /> Add More Attributes
                    </span>
                  </div>

                  <div className="group-items-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th>
                            SKU <p onClick={handleCopySkuToAll}>Generate SKU</p>
                          </th>
                          {!formData.isProductUnique && (
                            <th>
                              Quantity{" "}
                              <p onClick={handleCopyQuantityToAll}>
                                Copy to All
                              </p>
                            </th>
                          )}
                          <th>
                            Cost Price{" "}
                            <p onClick={handleCopyCostToAll}>Copy to All</p>
                          </th>
                          <th>
                            Selling Price{" "}
                            <p onClick={handleCopyPriceToAll}>Copy to All</p>
                          </th>
                          <th>
                            Warehouse{" "}
                            <p onClick={handleCopyWarehouseToAll}>
                              Copy to All
                            </p>
                          </th>
                          <th>Item Image</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combinations.length > 0 ? (
                          combinations.map((com, index) => (
                            <tr key={index} className="individual_item_group">
                              <td className="group-item-name">
                                <textarea
                                  onChange={(e) =>
                                    handleSetCombinationName(e, index)
                                  }
                                  name="item-name"
                                  value={com}
                                  cols="30"
                                  rows="2"
                                ></textarea>
                              </td>
                              <td>
                                <textarea
                                  onChange={(e) => handleSkuChange(e, index)}
                                  name="sku"
                                  value={sku[index] || ""}
                                  rows="2"
                                ></textarea>
                              </td>
                              {!formData.isProductUnique && (
                                // <td>
                                //   <textarea
                                //     onChange={(e) =>
                                //       handleQuantityChange(e, index)
                                //     }
                                //     name="quantity"
                                //     value={quantity[index] || ""}
                                //     rows="2"
                                //     min="0"
                                //   ></textarea>
                                //   {mode === "edit" && (
                                //     <>
                                //       <button
                                //         type="button"
                                //         onClick={() =>
                                //           handleQuantityModalOpen(index, "add")
                                //         }
                                //       >
                                //         +
                                //       </button>
                                //       <button
                                //         type="button"
                                //         onClick={() =>
                                //           handleQuantityModalOpen(
                                //             index,
                                //             "subtract"
                                //           )
                                //         }
                                //       >
                                //         -
                                //       </button>
                                //     </>
                                //   )}
                                // </td>
                                <td>
                                  <div className="quantity-container">
                                    {/* {mode === "edit" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleQuantityModalOpen(index, "add")
                                        }
                                      >
                                        +
                                      </button>
                                    )} */}
                                    {mode === "edit" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleQuantityModalOpen(
                                            index,
                                            "subtract"
                                          )
                                        }
                                      >
                                        -
                                      </button>
                                    )}
                                    <textarea
                                      onChange={(e) =>
                                        handleQuantityChange(e, index)
                                      }
                                      name="quantity"
                                      value={quantity[index] || ""}
                                      rows="2"
                                      min="0"
                                    ></textarea>
                                    {mode === "edit" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleQuantityModalOpen(index, "add")
                                        }
                                      >
                                        +
                                      </button>
                                    )}
                                    {/* {mode === "edit" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleQuantityModalOpen(
                                            index,
                                            "subtract"
                                          )
                                        }
                                      >
                                        -
                                      </button>
                                    )} */}
                                  </div>
                                </td>
                              )}
                              <td>
                                <textarea
                                  onChange={(e) => handleCostChange(e, index)}
                                  name="cost"
                                  value={cost[index] || ""}
                                  rows="2"
                                ></textarea>
                              </td>
                              <td>
                                <textarea
                                  onChange={(e) => handlePriceChange(e, index)}
                                  name="price"
                                  value={price[index] || ""}
                                  rows="2"
                                ></textarea>
                              </td>
                              <td>
                                <textarea
                                  onChange={(e) =>
                                    handleWarehouseChange(e, index)
                                  }
                                  name="warehouse"
                                  value={warehouse[index] || ""}
                                  rows="2"
                                ></textarea>
                              </td>
                              <td>
                                <div className="combination-image-cell">
                                  <div
                                    className="combination-image-upload"
                                    onClick={() =>
                                      document
                                        .getElementById(
                                          `combinationImageUpload-${index}`,
                                        )
                                        .click()
                                    }
                                  >
                                    {combinationImagePreviews?.[index]?.[0] ? (
                                      <img
                                        src={combinationImagePreviews[index][0]}
                                        alt="Item preview"
                                        className="combination-selected-image"
                                      />
                                    ) : (
                                      <span>Upload image</span>
                                    )}
                                  </div>
                                  <input
                                    id={`combinationImageUpload-${index}`}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) =>
                                      handleCombinationImageChange(e, index)
                                    }
                                    style={{ display: "none" }}
                                  />
                                  {!!combinationImagePreviews?.[index]?.length && (
                                    <small>
                                      {combinationImagePreviews[index].length} image(s)
                                    </small>
                                  )}
                                </div>
                              </td>
                              <RxCrossCircled
                                onClick={() => handleDeleteCombination(com)}
                                className="delete-combinations"
                                size={16}
                              />
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="7">
                              <p>
                                Enter attributes to generate combinations...
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="submit-product-group">
                    <button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <ButtonSpinner />}
                      {mode === "add" ? "Add Products" : "Update Products"}
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}
        </>
      ) : (
        <div className="unauthorized-containers">
          <h1>Unauthorized</h1>
        </div>
      )}
    </>
  );
}

const Modal = ({ show, message, onConfirm, onCancel, currentUser }) => {
  if (!show) return null;

  const overlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  };

  const modalStyle = {
    background: "white",
    padding: "20px",
    borderRadius: "8px",
    textAlign: "center",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
    maxWidth: "500px",
    width: "100%",
  };

  const buttonStyle = {
    margin: "10px",
    padding: "8px 20px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "14px",
  };

  const confirmButtonStyle = {
    ...buttonStyle,
    backgroundColor: "#295F2D",
    color: "white",
  };

  const h1Style = {
    margin: "0 0 10px",
    fontSize: "16px",
  };

  const pStyle = {
    margin: "0 0 10px",
    fontSize: "12px",
  };

  const cancelButtonStyle = {
    ...buttonStyle,
    backgroundColor: "transparent",
    color: "#295F2D",
    border: "1px solid #295F2D",
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={modalStyle}>
        <h1 style={h1Style}>Are you sure you want to change this setting?</h1>
        <p style={pStyle}>{message}</p>

        {currentUser.subscription.plan === "Professional" ? (
          <button style={confirmButtonStyle} onClick={onConfirm}>
            Confirm
          </button>
        ) : (
          <button
            onClick={() =>
              toast.info("Upgrade to professional plan to add unique products")
            }
            style={confirmButtonStyle}
          >
            Confirm
          </button>
        )}

        <button style={cancelButtonStyle} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

const QuantityModal = ({
  show,
  onCancel,
  onConfirm,
  quantityChange,
  setQuantityChange,
  action,
}) => {
  if (!show) return null;

  return (
    <>
      <div className="payment_tooltip_overlay" onClick={onCancel} />
      <div
        className="payment_tooltip quantity_tooltip"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="payment_tooltip_header">
          <span>{action === "add" ? "Add Quantity" : "Subtract Quantity"}</span>
          <button className="tooltip_close_btn" onClick={onCancel}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 1L13 13M1 13L13 1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="payment_tooltip_body">
          <input
            type="number"
            className="quantity_input"
            value={quantityChange}
            onChange={(e) => setQuantityChange(e.target.value)}
            placeholder="Enter quantity"
          />
          <div className="tooltip_actions">
            <button className="tooltip_action_btn confirm" onClick={onConfirm}>
              Confirm
            </button>
            <button className="tooltip_action_btn cancel" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
