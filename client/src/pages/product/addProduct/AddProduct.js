import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Loader from "../../../components/loader/Loader";
import ProductForm from "../../../components/productForm/ProductForm";
import {
  createProduct,
  selectIsLoading,
} from "../../../redux/features/product/productSlice";
import { selectConnectedStores } from "../../../redux/features/auth/authSlice";
import { toast } from "sonner";
import { useAsyncToast } from "../../../customHook/useAsyncToast";

const initialState = {
  name: "",
  category: "",
  quantity: "",
  warehouse: "",
  price: "",
  cost: "",
  description: "",
};

const AddProduct = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [product, setProduct] = useState(initialState);
  const [productImageItems, setProductImageItems] = useState([]);
  const [activeProductImageId, setActiveProductImageId] = useState(null);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [quantityDistribution, setQuantityDistribution] = useState("same");
  const [branchQuantities, setBranchQuantities] = useState({});
  const { executeWithToast } = useAsyncToast();

  const isLoading = useSelector(selectIsLoading);
  const connectedStores = useSelector(selectConnectedStores);

  const { name, category, price, quantity, cost, warehouse, description } =
    product;

  const handleInputChange = (e) => {
    let { name, value } = e.target;

    if (name === "price" || name === "cost") {
      if (isNaN(value) || value < 0) {
        toast.error("Only numbers are allowed.");
        value = "";
        return;
      }
    }
    setProduct({ ...product, [name]: value });
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems = files.map((file, index) => ({
      id: `new-${Date.now()}-${index}-${file.name}`,
      file,
      previewUrl: URL.createObjectURL(file),
      existing: false,
    }));

    setProductImageItems((prev) => [...prev, ...newItems]);
    setActiveProductImageId(newItems[newItems.length - 1].id);

    e.target.value = "";
  };

  const handleSelectProductImage = (imageId) => {
    setActiveProductImageId(imageId);
  };

  const handleDeleteProductImage = (imageId) => {
    setProductImageItems((prev) => {
      const target = prev.find((item) => item.id === imageId);
      if (target?.previewUrl && target?.existing === false) {
        URL.revokeObjectURL(target.previewUrl);
      }

      const next = prev.filter((item) => item.id !== imageId);
      if (activeProductImageId === imageId) {
        setActiveProductImageId(next[next.length - 1]?.id || null);
      }
      return next;
    });
  };

  const handleBranchChange = (branchId, isChecked) => {
    if (isChecked) {
      setSelectedBranches((prev) => [...prev, branchId]);
    } else {
      setSelectedBranches((prev) => prev.filter((id) => id !== branchId));
    }
  };

  const handleQuantityDistributionChange = (value) => {
    setQuantityDistribution(value);

    // Reset branch quantities when switching distribution method
    if (value === "split") {
      const totalQty = parseInt(product.quantity || 0, 10);
      const perBranch = Math.floor(totalQty / selectedBranches.length);
      const newBranchQuantities = {};
      selectedBranches.forEach((branchId) => {
        newBranchQuantities[branchId] = perBranch;
      });
      setBranchQuantities(newBranchQuantities);
    } else {
      setBranchQuantities({});
    }
  };

  const handleBranchQuantityChange = (branchId, quantity) => {
    setBranchQuantities((prev) => ({
      ...prev,
      [branchId]: quantity,
    }));
  };

  const generateKSKU = (category) => {
    const letter = category.slice(0, 3).toUpperCase();
    const number = Date.now();
    const sku = letter + "-" + number;
    return sku;
  };

  const saveProduct = async (e) => {
    e.preventDefault();

    // Validate branch selection
    if (selectedBranches.length === 0) {
      toast.error("Please select at least one branch");
      return;
    }

    try {
      // Create product for each selected branch
      const branchesToCreate = selectedBranches.length;
      let successCount = 0;

      for (const branchId of selectedBranches) {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("sku", generateKSKU(category));
        formData.append("category", category);
        formData.append("branchId", branchId);

        // Set quantity based on distribution method
        if (quantityDistribution === "split") {
          formData.append("quantity", branchQuantities[branchId] || 0);
        } else {
          // Same quantity for all branches
          formData.append("quantity", Number(quantity));
        }

        formData.append("warehouse", warehouse);
        formData.append("price", price);
        formData.append("cost", cost);
        formData.append("description", description);

        productImageItems
          .filter((item) => item.file)
          .forEach((item) => {
            formData.append("image", item.file);
          });

        formData.append("existingImages", JSON.stringify([]));

        console.log("formData sent for branch", branchId, formData);

        // Create product for this branch
        try {
          await dispatch(createProduct(formData));
          successCount++;
        } catch (error) {
          console.error(`Failed to create product for branch ${branchId}:`, error);
        }
      }

      // Show success message
      if (successCount === branchesToCreate) {
        toast.success("Product created successfully in all branches!");
      } else if (successCount > 0) {
        toast.warning(`Product created in ${successCount} of ${branchesToCreate} branches`);
      } else {
        toast.error("Failed to create product. Please try again.");
        return;
      }

      navigate(`/inventory`);
    } catch (error) {
      toast.error("Failed to create product. Please try again.");
      console.error("Product creation error:", error);
    }
  };

  return (
    <div>
      {/* Loader removed - using toast notifications instead */}
      <ProductForm
        product={product}
        description={description}
        handleInputChange={handleInputChange}
        saveProduct={saveProduct}
        handleImageChange={handleImageChange}
        productImageItems={productImageItems}
        activeProductImageId={activeProductImageId}
        handleSelectProductImage={handleSelectProductImage}
        handleDeleteProductImage={handleDeleteProductImage}
        mode="add"
        selectedBranches={selectedBranches}
        onBranchChange={handleBranchChange}
        quantityDistribution={quantityDistribution}
        onQuantityDistributionChange={handleQuantityDistributionChange}
        branchQuantities={branchQuantities}
        onBranchQuantityChange={handleBranchQuantityChange}
      />
    </div>
  );
};

export default AddProduct;
