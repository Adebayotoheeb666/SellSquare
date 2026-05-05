import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import {
  getProduct,
  updateProduct,
} from "../../../redux/features/product/productSlice";
import { selectAllProductsArray } from "../../../redux/features/product/productCacheSlice";
import ProductForm from "../../../components/productForm/ProductForm";
import { useAsyncToast } from "../../../customHook/useAsyncToast";
import { normalizeImageArray } from "../../../utils/productImageUtils";

const initialState = {
  name: "",
  category: "",
  quantity: "",
  price: "",
  warehouse: "",
  cost: "",
  sku: "",
  description: "",
};

const EditProduct = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const allProducts = useSelector(selectAllProductsArray);
  const { executeWithToast } = useAsyncToast();

  const [product, setProduct] = useState(null);
  const [description, setDescription] = useState("");
  const [productData, setProductData] = useState(initialState);
  const [productImageItems, setProductImageItems] = useState([]);
  const [activeProductImageId, setActiveProductImageId] = useState(null);

  useEffect(() => {
    // Find product from cache (no API call needed)
    const productToEdit = allProducts?.find((product) => product._id === id);
    if (productToEdit) {
      setProduct(productToEdit);
      setProductData(productToEdit);

      const existingImages = normalizeImageArray(
        productToEdit.images,
        productToEdit.image,
      );
      const mapped = existingImages.map((image, index) => ({
        id: `existing-${index}-${image.filePath || index}`,
        image,
        previewUrl: image.filePath,
        existing: true,
      }));
      setProductImageItems(mapped);
      setActiveProductImageId(mapped[mapped.length - 1]?.id || null);
    }
  }, [allProducts, id]);

  const generateKSKU = (category) => {
    const letter = category.slice(0, 3).toUpperCase();
    const number = Date.now();
    const sku = letter + "-" + number;
    return sku;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProduct({ ...product, [name]: value });
    setProductData((prevFormData) => ({
      ...prevFormData,
      [name]: value,
    }));
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

  const saveProduct = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("name", productData.name);
    formData.append("sku", generateKSKU(productData.category));
    formData.append("category", productData.category);
    formData.append("quantity", Number(productData.quantity));
    formData.append("warehouse", productData.warehouse);
    formData.append("price", productData.price);
    formData.append("cost", productData.cost);
    formData.append("description", productData.description);
    const existingImages = productImageItems
      .filter((item) => item.existing && item.image)
      .map((item) => item.image);

    formData.append("existingImages", JSON.stringify(existingImages));

    productImageItems
      .filter((item) => item.file)
      .forEach((item) => {
        formData.append("image", item.file);
      });
    // });

    try {
      await executeWithToast(dispatch(updateProduct({ id, formData })), {
        loading: "Updating product...",
        success: "Product updated successfully!",
        error: "Failed to update product. Please try again.",
      });

      // Navigate after successful update (realtime sync handles cache update)
      navigate(`/inventory/product/${id}`);
    } catch (error) {
      console.error("Product update error:", error);
    }
  };

  return (
    <div>
      {/* Loader removed - using toast notifications instead */}
      <ProductForm
        product={product}
        setDescription={setDescription}
        description={description}
        handleInputChange={handleInputChange}
        saveProduct={saveProduct}
        handleImageChange={handleImageChange}
        productImageItems={productImageItems}
        activeProductImageId={activeProductImageId}
        handleSelectProductImage={handleSelectProductImage}
        handleDeleteProductImage={handleDeleteProductImage}
        mode="edit"
      />
    </div>
  );
};

export default EditProduct;
