import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  SET_BUSINESS,
  selectBusiness,
  selectLoggedInBusinessOwner,
  selectUser,
} from "../../../../redux/features/auth/authSlice";
import { deleteSales, getBusiness } from "../../../../services/authService";
import AddSales from "./AddSales";
import { confirmAlert } from "react-confirm-alert";
import { toast } from "sonner";
import EditSales from "./EditSales";
import { useAsyncToast } from "../../../../customHook/useAsyncToast";

export default function SalesList() {
  const dispatch = useDispatch();
  /**
   * EVENT-DRIVEN ARCHITECTURE:
   * Business data is loaded during bootstrap (useDataBootstrap in Layout).
   * This component NEVER fetches business data - it only reads from Redux.
   * Updates come via:
   * 1. Initial bootstrap load
   * 2. WebSocket events when business is updated
   * 3. Explicit refetch after mutations (add/delete sales rep)
   */
  const business = useSelector(selectBusiness);
  const [newSalesModal, setNewSalesModal] = useState(false);
  const [editSalesModal, setEditSalesModal] = useState(false);
  const [editSaleIndex, setEditSaleIndex] = useState(null);
  const currentUser = useSelector(selectUser);
  const admin = useSelector(selectLoggedInBusinessOwner);
  const { executeWithToast } = useAsyncToast();

  console.log("currentUser:", currentUser.subscription);

  const confirmDelete = (email) => {
    confirmAlert({
      title: "Delete sales person",
      message: "Are you sure you want to delete this person.",
      buttons: [
        {
          label: "Delete",
          onClick: async () => {
            try {
              await executeWithToast(
                (async () => {
                  const data = await deleteSales({ email });
                  if (data.message) {
                    throw new Error(data.message);
                  }
                  // After successful mutation, refresh business data from backend
                  // This is acceptable - mutations can trigger explicit refetches
                  const businessData = await getBusiness();
                  await dispatch(SET_BUSINESS(businessData));
                })(),
                {
                  loading: "Deleting sales rep...",
                  success: "Sales rep deleted successfully!",
                  error: (err) => err.message || "Failed to delete sales rep.",
                }
              );
            } catch (error) {
              console.error("Delete sales error:", error);
            }
          },
        },
        {
          label: "Cancel",
        },
      ],
    });
  };

  // No useEffect needed - business data comes from Redux (loaded in bootstrap)
  // If business is null, it means bootstrap hasn't completed yet

  return (
    <>
      {admin || currentUser?.permissions?.grantPermissions ? (
        <div className="business-profile-item">
          {/* Loader removed - using toast notifications instead */}
          {newSalesModal && (
            <AddSales handleCancel={() => setNewSalesModal(!newSalesModal)} />
          )}
          <div className="add-sales-rep">
            <h3>Staff List ({business?.sales?.length})</h3>
            {(currentUser.subscription?.plan === "Free" &&
              business?.sales?.length < 1) ||
              (currentUser.subscription?.plan === "Basic" &&
                business?.sales?.length < 1) ||
              (currentUser.subscription?.plan === "Standard" &&
                business?.sales?.length < 2) ||
              (currentUser.subscription?.plan === "Professional" &&
                business?.sales?.length < 5) ? (
              <button onClick={() => setNewSalesModal(!newSalesModal)}>
                Add
              </button>
            ) : (
              <button
                onClick={() =>
                  toast.info("Upgrade to a higher plan to add more sales reps.")
                }
              >
                Add
              </button>
            )}
          </div>
          {business?.sales?.map((sale, index) => {
            return (
              <div key={index}>
                {editSalesModal && editSaleIndex === index && (
                  <EditSales
                    sale={sale}
                    handleCancel={() => setEditSalesModal(false)}
                  />
                )}
                <div className="item-container">
                  <div className="item-img-name">
                    <div>
                      <h2>{sale.firstName + " " + sale.lastName}</h2>
                      <h5>{sale.email}</h5>
                      <br />
                      {sale.branchAssignments && sale.branchAssignments.length > 0 && (
                        <div className="sales-branch-assignments">
                          <h3>Assigned Stores</h3>
                          <ul>
                            {sale.branchAssignments.map((assignment, idx) => {
                              const permissions = assignment.permissions || {};
                              const grantedPermissions = Object.keys(permissions)
                                .filter(key => permissions[key])
                                .length;
                              return (
                                <li key={idx}>
                                  {assignment.storeId}
                                  {grantedPermissions > 0 && ` (${grantedPermissions} permission${grantedPermissions > 1 ? 's' : ''})`}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                      <div className="sales-permissions">
                        <h3>Permissions</h3>
                        <table>
                          <tbody>
                            <tr>
                              <td>Add Products</td>
                              <td>
                                {sale.permissions?.addProducts ? "Yes" : "No"}
                              </td>
                            </tr>
                            <tr>
                              <td>Delete Products</td>
                              <td>
                                {sale.permissions?.deleteProducts
                                  ? "Yes"
                                  : "No"}
                              </td>
                            </tr>
                            <tr>
                              <td>Edit Products</td>
                              <td>
                                {sale.permissions?.editproducts ? "Yes" : "No"}
                              </td>
                            </tr>
                            <tr>
                              <td>Return Items</td>
                              <td>
                                {sale.permissions?.returnItems ? "Yes" : "No"}
                              </td>
                            </tr>
                            <tr>
                              <td>Sell Products</td>
                              <td>
                                {sale.permissions.sellProducts ? "Yes" : "No"}
                              </td>
                            </tr>
                            <tr>
                              <td>Grant Permissions</td>
                              <td>
                                {sale.permissions.grantPermissions
                                  ? "Yes"
                                  : "No"}
                              </td>
                            </tr>
                            <tr>
                              <td>See Business Finances</td>
                              <td>
                                {sale.permissions?.seeBusinessFinances
                                  ? "Yes"
                                  : "No"}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  <div className="staff-actions">
                    <button
                      onClick={() => {
                        setEditSalesModal(true);
                        setEditSaleIndex(index);
                      }}
                      className="btn-edit"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.3333 2L14 4.66667L5.33333 13.3333H2.66667V10.6667L11.3333 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M9.66667 3.66667L12.3333 6.33333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => confirmDelete(sale.email)}
                      className="btn-delete"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 4H3.33333H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5.33333 4V2.66667C5.33333 2.31304 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31304 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31304 10.6667 2.66667V4M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0261 12.2761 14.2761C12.0261 14.5262 11.687 14.6667 11.3333 14.6667H4.66667C4.31304 14.6667 3.97391 14.5262 3.72386 14.2761C3.47381 14.0261 3.33333 13.687 3.33333 13.3333V4H12.6667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="business-profile-item stores">
          <h3>Unauthorized</h3>
        </div>
      )}
    </>
  );
}
