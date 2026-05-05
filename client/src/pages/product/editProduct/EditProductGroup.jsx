import useProductGroup from "../../../customHook/useProductGroup";
import { useParams } from "react-router-dom";
import ProductGroupForm from "../../../components/productGroupForm/ProductGroupForm";

export default function EditProductGroup() {
  const { id } = useParams();
  const {
    isLoading,
    admin,
    currentUser,
    formData,
    attributes,
    combinations,
    sku,
    price,
    warehouse,
    quantity,
    cost,
    options,
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
    handleCombinationImageChange,
    handleSelectGroupImage,
    handleDeleteGroupImage,
    groupImageItems,
    activeGroupImageId,
    combinationImagePreviews,
  } = useProductGroup({ mode: "edit", id });

  return (
    <ProductGroupForm
      mode="edit"
      isLoading={isLoading}
      admin={admin}
      currentUser={currentUser}
      formData={formData}
      attributes={attributes}
      combinations={combinations}
      sku={sku}
      price={price}
      warehouse={warehouse}
      quantity={quantity}
      cost={cost}
      options={options}
      inputRefs={inputRefs}
      handleInputChange={handleInputChange}
      handleBlur={handleBlur}
      handleKeyPress={handleKeyPress}
      handleAddAttribute={handleAddAttribute}
      handleDeleteAttribute={handleDeleteAttribute}
      handleRemoveItem={handleRemoveItem}
      handleDeleteCombination={handleDeleteCombination}
      handleSetCombinationName={handleSetCombinationName}
      handleSkuChange={handleSkuChange}
      handlePriceChange={handlePriceChange}
      handleCostChange={handleCostChange}
      handleWarehouseChange={handleWarehouseChange}
      handleQuantityChange={handleQuantityChange}
      handleCopySkuToAll={handleCopySkuToAll}
      handleCopyCostToAll={handleCopyCostToAll}
      handleCopyPriceToAll={handleCopyPriceToAll}
      handleCopyWarehouseToAll={handleCopyWarehouseToAll}
      handleCopyQuantityToAll={handleCopyQuantityToAll}
      saveProductGroup={saveProductGroup}
      focusInput={focusInput}
      handleImageChange={handleImageChange}
      handleCombinationImageChange={handleCombinationImageChange}
      groupImageItems={groupImageItems}
      activeGroupImageId={activeGroupImageId}
      handleSelectGroupImage={handleSelectGroupImage}
      handleDeleteGroupImage={handleDeleteGroupImage}
      combinationImagePreviews={combinationImagePreviews}
    />
  );
}
