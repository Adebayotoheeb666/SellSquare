import React, { useState } from "react";
import "./return.css";
import { Tooltip } from "antd";
import { returnedGoods } from "../../../redux/features/cart/cartSlice";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import useFormatter from "../../../customHook/useFormatter";

export default function ReturnFunction({
  handleCancel,
  selectedCheckout,
  admin,
  currentUser,
}) {
  const dispatch = useDispatch();
  const [selectedItems, setSelectedItems] = useState([]);

  const { formatter } = useFormatter();

  const handleSelect = (itemId) => {
    setSelectedItems((prevSelectedItems) =>
      prevSelectedItems.includes(itemId)
        ? prevSelectedItems.filter((id) => id !== itemId)
        : [...prevSelectedItems, itemId]
    );
  };

  const handleReturnSelected = async () => {
    if (!selectedCheckout) return;

    // Handle the return of selected items
    const itemsToReturn = selectedCheckout.items.filter((item) =>
      selectedItems.includes(item._id)
    );
    const formData = {
      itemsToReturn: itemsToReturn,
    };

    await handleCancel();
    if (itemsToReturn.length > 0) {
      await dispatch(returnedGoods({ id: selectedCheckout._id, formData }));
    } else {
      toast.error("Please select the item(s) to be returned.");
    }
  };

  const handleReturnAllItems = async () => {
    if (!selectedCheckout) return;

    // Handle the return of selected items
    const itemsToReturn = selectedCheckout.items;
    const formData = {
      itemsToReturn: itemsToReturn,
    };

    // console.log("Returning selected items:", itemsToReturn);
    await handleCancel();
    if (itemsToReturn.length > 0) {
      await dispatch(returnedGoods({ id: selectedCheckout._id, formData }));
    } else {
      toast.error("Please select the item(s) to be returned.");
    }
  };

  if (!selectedCheckout) {
    return null;
  }

  return (
    <div className="return_content_body">
      <span onClick={() => handleCancel()}>close</span>
      <div className="items_to_return">
        <div className="return_header">
          <h3>Items to return</h3>
        </div>
        <div className="current_items">
          <table>
            <thead>
              <tr>
                <th>Select</th>
                <th>Product Name</th>
                <th>Selling Price</th>
                <th>Cost Price</th>
                <th>Quantity</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {selectedCheckout.items && selectedCheckout.items.map((item, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item._id)}
                      onChange={() => handleSelect(item._id)}
                    />
                  </td>
                  <td>{item.name}</td>
                  <td>{formatter(item.price)}</td>
                  <td>
                    {admin || currentUser?.permissions?.seeBusinessFinances
                      ? formatter(item.cost)
                      : "Unavailable"}
                  </td>
                  <td>{item.quantity}</td>
                  <td>
                    {admin || currentUser?.permissions?.seeBusinessFinances
                      ? formatter(
                        item.price * item.quantity -
                        item.cost * item.quantity
                      )
                      : "Unavailable"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="return_item_buttons">
          <button onClick={handleReturnSelected}>
            Return {selectedItems.length} item(s)
          </button>
          <button onClick={handleReturnAllItems} className="return_all_btn">
            Return All
          </button>
        </div>
      </div>
    </div>
  );
}
