import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { addSales, getBusiness } from "../../../../services/authService";
import { useAsyncToast } from "../../../../customHook/useAsyncToast";
import { toast } from "sonner";
import { SET_BUSINESS } from "../../../../redux/features/auth/authSlice";

// Eye Icon SVG Component
const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 4C4.5 4 2 10 2 10C2 10 4.5 16 10 16C15.5 16 18 10 18 10C18 10 15.5 4 10 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const initialState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  permissions: {
    addProducts: false,
    deleteProducts: false,
    editProducts: false,
    returnItems: false,
    grantPermissions: false,
    seeBusinessFinances: false,
    sellProducts: true,
  },
  branchAssignments: [],
};

export default function AddSales({ handleCancel }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const business = useSelector((state) => state.auth.business);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState(initialState);
  const [assignToDefaultStore, setAssignToDefaultStore] = useState(false);
  const { executeWithToast } = useAsyncToast();

  const { firstName, lastName, email, password } = formData;
  const connectedStores = business?.connectedStores || [];

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "email") {
      setFormData({ ...formData, [name]: value.toLowerCase() });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handlePermissionChange = (e) => {
    const { name, checked } = e.target;
    setFormData({
      ...formData,
      permissions: { ...formData.permissions, [name]: checked },
    });
  };

  const handleBranchChange = (storeId, permissions) => {
    // Create a new copy of assignments to avoid mutating frozen objects
    const assignments = [...(formData.branchAssignments || [])];
    const existingIndex = assignments.findIndex((a) => a.storeId === storeId);

    if (existingIndex >= 0) {
      // Update existing assignment
      assignments[existingIndex] = { ...assignments[existingIndex], permissions };
    } else {
      // Add new assignment
      const defaultPermissions = {
        addProducts: false,
        deleteProducts: false,
        editProducts: false,
        returnItems: false,
        grantPermissions: false,
        seeBusinessFinances: false,
        sellProducts: false,
      };
      assignments.push({ storeId, permissions: { ...defaultPermissions, ...permissions } });
    }

    setFormData({
      ...formData,
      branchAssignments: assignments,
    });
  };

  const handleBranchPermissionChange = (storeId, permissionName, checked) => {
    const assignments = (formData.branchAssignments || []).map((assignment) => {
      if (assignment.storeId === storeId) {
        return {
          ...assignment,
          permissions: {
            ...assignment.permissions,
            [permissionName]: checked,
          },
        };
      }
      return assignment;
    });
    setFormData({
      ...formData,
      branchAssignments: assignments,
    });
  };

  const handleRemoveBranch = (storeId) => {
    const assignments = (formData.branchAssignments || []).filter(
      (a) => a.storeId !== storeId
    );
    setFormData({
      ...formData,
      branchAssignments: assignments,
    });
  };

  const handleDefaultStoreToggle = (e) => {
    const isChecked = e.target.checked;
    setAssignToDefaultStore(isChecked);

    if (isChecked && business?._id) {
      // Add default store to assignments
      const assignments = [...(formData.branchAssignments || [])];
      const alreadyAssigned = assignments.some((a) => a.storeId === business._id);

      if (!alreadyAssigned) {
        const defaultPermissions = {
          addProducts: false,
          deleteProducts: false,
          editProducts: false,
          returnItems: false,
          grantPermissions: false,
          seeBusinessFinances: false,
          sellProducts: false,
        };
        assignments.push({ storeId: business._id, permissions: defaultPermissions });
        setFormData({
          ...formData,
          branchAssignments: assignments,
        });
      }
    } else if (!isChecked && business?._id) {
      // Remove default store from assignments
      const assignments = (formData.branchAssignments || []).filter(
        (a) => a.storeId !== business._id
      );
      setFormData({
        ...formData,
        branchAssignments: assignments,
      });
    }
  };

  const addNewSalesRep = async (e) => {
    e.preventDefault();

    try {
      const userData = {
        ...formData,
      };

      await executeWithToast(
        (async () => {
          const data = await addSales(userData);
          navigate("/accounts/sales");
          if (data.message) {
            throw new Error(data.message);
          }
          const businessData = await getBusiness();
          await dispatch(SET_BUSINESS(businessData));
          handleCancel();
        })(),
        {
          loading: "Adding sales rep...",
          success: "Sales rep added successfully!",
          error: (err) => err.message || "Failed to add sales rep.",
        }
      );
    } catch (error) {
      console.error("Add sales error:", error);
    }
  };

  return (
    <div className="add-new-sales" onClick={handleCancel}>
      {/* Loader removed - using toast notifications instead */}
      <div className="new-sales-data" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={(e) => addNewSalesRep(e)}>
          <div className="sales-details">
            <h1>Add New Staff Member</h1>
            <div className="form-field">
              <div>
                <label>First Name*</label>
                <input
                  type="text"
                  placeholder="John"
                  required
                  name="firstName"
                  value={firstName}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label>Last Name*</label>
                <input
                  type="text"
                  placeholder="Doe"
                  required
                  name="lastName"
                  value={lastName}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-field">
              <div>
                <label>Email*</label>
                <input
                  type="email"
                  placeholder="staff@gmail.com"
                  required
                  name="email"
                  value={email}
                  onChange={handleInputChange}
                />
              </div>
              <div className="password-input">
                <label>Password*</label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="*********"
                  required
                  name="password"
                  value={password}
                  onChange={handleInputChange}
                />
                <div
                  onClick={() => setShowPassword(!showPassword)}
                  className="show-password"
                >
                  {!showPassword && <div className="cross-line"></div>}
                  <EyeIcon />
                </div>
              </div>
            </div>
          </div>
          <div className="permissions">
            <h3>Permissions</h3>
            <div className="permissions-boxes">
              <label>
                <input
                  type="checkbox"
                  name="addProducts"
                  checked={formData.permissions.addProducts}
                  onChange={handlePermissionChange}
                />
                Add Products
              </label>
              <label>
                <input
                  type="checkbox"
                  name="deleteProducts"
                  checked={formData.permissions.deleteProducts}
                  onChange={handlePermissionChange}
                />
                Delete products
              </label>
              <label>
                <input
                  type="checkbox"
                  name="editProducts"
                  checked={formData.permissions.editProducts}
                  onChange={handlePermissionChange}
                />
                Edit products
              </label>
              <label>
                <input
                  type="checkbox"
                  name="returnItems"
                  checked={formData.permissions.returnItems}
                  onChange={handlePermissionChange}
                />
                Return Items
              </label>
              <label>
                <input
                  type="checkbox"
                  name="grantPermissions"
                  checked={formData.permissions.grantPermissions}
                  onChange={handlePermissionChange}
                />
                Grant permissions
              </label>
              <label>
                <input
                  type="checkbox"
                  name="seeBusinessFinances"
                  checked={formData.permissions.seeBusinessFinances}
                  onChange={handlePermissionChange}
                />
                See Business Finances
              </label>
              <label>
                <input
                  type="checkbox"
                  name="sellProducts"
                  checked={formData.permissions.sellProducts}
                  onChange={handlePermissionChange}
                />
                Sell products
              </label>
            </div>
          </div>
          <div className="default-store-assignment">
            <label className="default-store-toggle">
              <input
                type="checkbox"
                checked={assignToDefaultStore}
                onChange={handleDefaultStoreToggle}
              />
              Assign to my default store ({business?.businessName})
            </label>
          </div>
          {connectedStores.length > 0 && (
            <div className="branch-assignments">
              <h3>Branch Assignments</h3>
              <p className="branch-subtitle">Select additional branches to assign to this staff member</p>
              <div className="branch-list">
                {connectedStores.map((store) => {
                  const assignment = (formData.branchAssignments || []).find(
                    (a) => a.storeId === store._id
                  );
                  const isSelected = !!assignment;

                  return (
                    <div key={store._id} className="branch-item">
                      <div className="branch-checkbox">
                        <input
                          type="checkbox"
                          id={`branch-${store._id}`}
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const defaultPermissions = {
                                addProducts: false,
                                deleteProducts: false,
                                editProducts: false,
                                returnItems: false,
                                grantPermissions: false,
                                seeBusinessFinances: false,
                                sellProducts: false,
                              };
                              handleBranchChange(store._id, defaultPermissions);
                            } else {
                              handleRemoveBranch(store._id);
                            }
                          }}
                        />
                        <label htmlFor={`branch-${store._id}`}>
                          {store.businessName || "Branch"}
                        </label>
                      </div>
                      {isSelected && (
                        <div className="branch-permissions">
                          <label>
                            <input
                              type="checkbox"
                              checked={assignment.permissions?.addProducts || false}
                              onChange={(e) =>
                                handleBranchPermissionChange(store._id, "addProducts", e.target.checked)
                              }
                            />
                            Add Products
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={assignment.permissions?.deleteProducts || false}
                              onChange={(e) =>
                                handleBranchPermissionChange(store._id, "deleteProducts", e.target.checked)
                              }
                            />
                            Delete Products
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={assignment.permissions?.editProducts || false}
                              onChange={(e) =>
                                handleBranchPermissionChange(store._id, "editProducts", e.target.checked)
                              }
                            />
                            Edit Products
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={assignment.permissions?.returnItems || false}
                              onChange={(e) =>
                                handleBranchPermissionChange(store._id, "returnItems", e.target.checked)
                              }
                            />
                            Return Items
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={assignment.permissions?.grantPermissions || false}
                              onChange={(e) =>
                                handleBranchPermissionChange(store._id, "grantPermissions", e.target.checked)
                              }
                            />
                            Grant Permissions
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={assignment.permissions?.seeBusinessFinances || false}
                              onChange={(e) =>
                                handleBranchPermissionChange(store._id, "seeBusinessFinances", e.target.checked)
                              }
                            />
                            See Business Finances
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={assignment.permissions?.sellProducts || false}
                              onChange={(e) =>
                                handleBranchPermissionChange(store._id, "sellProducts", e.target.checked)
                              }
                            />
                            Sell Products
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="submit-buttons">
            <button type="submit" className="add">
              Add
            </button>
            <button type="button" onClick={handleCancel} className="cancel">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
