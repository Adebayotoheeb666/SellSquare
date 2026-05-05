import { useState, useRef, useEffect, useCallback, createRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  createMultipleProducts,
  updateProductGroup,
  selectIsLoading,
  selectDraft,
  getDraft,
  saveDraft,
} from "../redux/features/product/productSlice";
import { selectProductGroupsArray } from "../redux/features/dataCache/bulkDataCacheSlice";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  selectIsLoggedIn,
  selectUser,
  selectLoggedInBusinessOwner,
  selectConnectedStores,
  selectCurrentBusiness,
} from "../redux/features/auth/authSlice";
import {
  getPrimaryImagePath,
  normalizeCombinationImageEntry,
  normalizeImageArray,
} from "../utils/productImageUtils";

// Initial state for form data
const initialState = {
  groupName: "",
  category: "",
  description: "",
  isProductUnique: false,
  cost: [],
  price: [],
  sku: [],
  warehouse: [],
  attributes: [],
  options: {},
  listingOptions: [],
  combinations: [],
  combinationImages: [],
  quantity: [],
  image: "",
};

// SKU Generation Function
const generateSKU = (groupName, combination) => {
  let part1 = combination.split("-");
  if (part1.length < 2) return "";
  let part2 = part1[1].split("/");

  const letter = part1[0].trim();
  const number = part2[0].trim().slice(-4);
  const sku = `${letter}-${number}`;
  return sku;
};

const validateFormData = (formData, setFormData) => {
  const errors = {};

  // Check required fields
  if (!formData.groupName || formData.groupName.trim() === "") {
    errors.groupName = "Group name is required.";
  }

  if (!formData.category || formData.category.trim() === "") {
    errors.category = "Category is required.";
  }

  if (!formData.description || formData.description.trim() === "") {
    errors.description = "Description is required.";
  }

  // Validate cost, price, and SKU arrays
  if (!Array.isArray(formData.cost) || formData.cost.length === 0) {
    errors.cost = "Cost is required and must be an array.";
  }

  if (!Array.isArray(formData.price) || formData.price.length === 0) {
    errors.price = "Price is required and must be an array.";
  }

  if (!Array.isArray(formData.sku) || formData.sku.length === 0) {
    errors.sku = "SKU is required and must be an array.";
  } else if (
    !formData.sku.every((sku) => typeof sku === "string" && sku.trim() !== "")
  ) {
    errors.sku = "All SKU values must be non-empty strings.";
  }

  // Validate warehouse (array of objects)
  if (!Array.isArray(formData.warehouse) || formData.warehouse.length === 0) {
    errors.warehouse = "Warehouse data is required and must be an array.";
  }

  // Validate quantity (array of numbers)
  if (!Array.isArray(formData.quantity) || formData.quantity.length === 0) {
    errors.quantity = "Quantity is required and must be an array.";
  } else {
    if (
      !formData.quantity.every((qty) => typeof qty === "number" && qty >= 0)
    ) {
      const updatedQuantity = formData.quantity.map((qty) =>
        typeof qty === "number" ? qty : parseInt(qty, 10),
      );
      setFormData((prevFormData) => ({
        ...prevFormData,
        quantity: updatedQuantity,
      }));
    }
  }

  // Validate attributes (array of objects)
  if (!Array.isArray(formData.attributes)) {
    errors.attributes = "Attributes must be an array.";
  }

  // Validate combinations (array of objects)
  if (!Array.isArray(formData.combinations)) {
    errors.combinations = "Combinations must be an array.";
  }

  // Check if there are any errors
  const isValid = Object.keys(errors).length === 0;

  return { isValid, errors };
};

const useProductGroup = ({ mode, id }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Selectors
  const isLoading = useSelector(selectIsLoading);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const draft = useSelector(selectDraft);
  const allProductGroups = useSelector(selectProductGroupsArray);
  const currentUser = useSelector(selectUser);
  const admin = useSelector(selectLoggedInBusinessOwner);
  const connectedStores = useSelector(selectConnectedStores);
  const currentBusiness = useSelector(selectCurrentBusiness);

  // Merge current business with connected stores for branch selection
  const allAvailableStores = currentBusiness
    ? [currentBusiness, ...connectedStores.filter(store => store._id !== currentBusiness._id)]
    : connectedStores;

  // State Management
  const [formData, setFormData] = useState(initialState);
  const [attributes, setAttributes] = useState([""]);
  const [combinations, setCombinations] = useState([]);
  const [quantity, setQuantity] = useState([]);
  const [sku, setSku] = useState([]);
  const [price, setPrice] = useState([]);
  const [warehouse, setWarehouse] = useState([]);
  const [cost, setCost] = useState([]);
  const [groupImageItems, setGroupImageItems] = useState([]);
  const [activeGroupImageId, setActiveGroupImageId] = useState(null);
  const [combinationImageFiles, setCombinationImageFiles] = useState({});
  const [combinationImagePreviews, setCombinationImagePreviews] = useState([]);
  const [combinationImages, setCombinationImages] = useState([]);
  const [draftId, setDraftId] = useState(null);
  const initialCombinationImagesRef = useRef(null);
  const [options, setOptions] = useState(() =>
    attributes.map(() => ({
      attr: [{ value: "", showInput: true }],
    })),
  );
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [quantityDistribution, setQuantityDistribution] = useState("same");
  const [branchQuantities, setBranchQuantities] = useState({});

  // Refs for input fields
  const inputRefs = useRef([]);

  function removeFromCombined(array, combinationToRemove, indexToRemove) {
    const arrayCopy = JSON.parse(JSON.stringify(array));

    if (combinationToRemove && indexToRemove >= 0) {
      arrayCopy.forEach((optionGroup) => {
        const attrArray = optionGroup.attr;

        if (indexToRemove < attrArray.length) {
          attrArray.splice(indexToRemove + 1, 1);
        }
      });

      return arrayCopy;
    }
    return arrayCopy;
  }

  // Combine Multiple Options Function
  const combineMultipleOptions = useCallback(
    (...optionsArrays) => {
      if (!formData.isProductUnique) {
        // combination of options #2
        const combinedArrays = [];

        function generate(index, currentCombination) {
          if (index === optionsArrays.length) {
            combinedArrays.push(currentCombination);
            return;
          }

          if (optionsArrays[index].length === 0) {
            generate(index + 1, currentCombination);
          } else {
            optionsArrays[index].forEach((element) => {
              generate(index + 1, [...currentCombination, element]);
            });
          }
        }

        generate(0, []);

        // return combinedArrays.map((combination) => combination.join("/"));
        return combinedArrays.map((combination) => {
          const combinedOption = combination.join("/");
          return formData.groupName
            ? `${formData.groupName} - ${combinedOption}`
            : combinedOption;
        });
      } else {
        // combination of options #1
        const maxLength = Math.max(...optionsArrays.map((arr) => arr.length));
        const combined = [];

        for (let i = 0; i < maxLength; i++) {
          const combinedOption = formData.groupName
            ? `${formData.groupName} - ${optionsArrays
                .map((arr) => arr[i] || "")
                .join("/")}`
            : optionsArrays.map((arr) => arr[i] || "").join("/");

          combined.push(combinedOption);
        }

        return combined;
      }
    },
    [formData.isProductUnique, formData.groupName],
  );

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      options: options,
    }));
  }, [options]);

  // Initialize inputRefs based on attributes
  useEffect(() => {
    // Ensure options are properly synced with attributes
    setOptions((prevOptions) => {
      const updatedOptions = attributes.map(
        (_, i) =>
          prevOptions[i] || {
            attr: [{ value: "", showInput: true }],
          },
      );
      return updatedOptions;
    });

    inputRefs.current = attributes.map(
      (_, i) => inputRefs.current[i] || createRef(),
    );
  }, [attributes]);

  // Initialize form data for edit mode
  useEffect(() => {
    if (mode === "edit" && id && allProductGroups.length > 0) {
      const productToEdit = allProductGroups.find(
        (product) => product._id === id,
      );
      // console.log("productToEdit", productToEdit)
      if (productToEdit) {
        const existingCombinationImages = Array.isArray(
          productToEdit.combinationImages,
        )
          ? productToEdit.combinationImages.map((entry) =>
              normalizeCombinationImageEntry(entry),
            )
          : [];
        const existingGroupImages = normalizeImageArray(
          productToEdit.images,
          productToEdit.image,
        );
        initialCombinationImagesRef.current = existingCombinationImages;

        setFormData({
          groupName: productToEdit.groupName,
          category: productToEdit.category,
          description: productToEdit.description,
          cost: productToEdit.cost,
          price: productToEdit.price,
          sku: productToEdit.sku,
          isProductUnique: productToEdit.isProductUnique,
          warehouse: productToEdit.warehouse,
          attributes: productToEdit.attributes,
          options: productToEdit.options,
          listingOptions: Array.isArray(productToEdit.listingOptions)
            ? productToEdit.listingOptions
            : [],
          combinations: productToEdit.combinations,
          combinationImages: existingCombinationImages,
          quantity: productToEdit.quantity,
          image: getPrimaryImagePath(existingGroupImages, productToEdit.image)
            ? existingGroupImages[0]
            : {},
          images: existingGroupImages,
        });
        setAttributes(productToEdit.attributes);
        setSku(productToEdit.sku);
        setPrice(productToEdit.price);
        setCombinations(productToEdit.combinations);
        setCost(productToEdit.cost);
        setWarehouse(productToEdit.warehouse);
        setOptions(productToEdit.options);
        setQuantity(productToEdit.quantity);
        setCombinationImages(existingCombinationImages);
        const mappedGroupImages = existingGroupImages.map((image, index) => ({
          id: `existing-group-${index}-${image.filePath || index}`,
          image,
          previewUrl: image.filePath,
          existing: true,
        }));
        setGroupImageItems(mappedGroupImages);
        setActiveGroupImageId(
          mappedGroupImages[mappedGroupImages.length - 1]?.id || null,
        );
        setCombinationImagePreviews(
          existingCombinationImages.map((images) =>
            images.map((image) => image?.filePath).filter(Boolean),
          ),
        );
      }
    }
  }, [mode, id, allProductGroups]);

  useEffect(() => {
    const updatedOptionsArrays = Object.values(options).map((option) =>
      option.attr.map((opt) => opt.value).filter((value) => value !== ""),
    );

    const combinedOptions = combineMultipleOptions(...updatedOptionsArrays);

    setCombinations(combinedOptions);

    // Update quantity array to match the length of combinations if isProductUnique is true
    setQuantity((prev) =>
      formData.isProductUnique ? Array(combinedOptions.length).fill(1) : prev,
    );

    setFormData((prev) => ({
      ...prev,
      combinations: combinedOptions,
      quantity: formData.isProductUnique
        ? Array(combinedOptions.length).fill(1)
        : prev.quantity,
    }));
  }, [options, combineMultipleOptions, formData.isProductUnique]);

  // Update combinations whenever options change considering isProductUnique
  useEffect(() => {
    const updatedOptionsArrays = Object.values(options).map((option) =>
      option.attr.map((opt) => opt.value).filter((value) => value !== ""),
    );

    const combinedOptions = combineMultipleOptions(...updatedOptionsArrays);

    setCombinations(combinedOptions);
    setFormData((prev) => ({
      ...prev,
      combinations: combinedOptions,
    }));
  }, [options, combineMultipleOptions]);

  useEffect(() => {
    const targetLength = combinations.length;
    const hasImageEntry = (entry) =>
      Array.isArray(entry) && entry.some((image) => image?.filePath);

    setCombinationImages((prev) => {
      const prevSeed = Array.isArray(prev) ? prev : [];
      const refSeed = Array.isArray(initialCombinationImagesRef.current)
        ? initialCombinationImagesRef.current
        : [];

      const next = Array.from({ length: targetLength }, (_, index) =>
        hasImageEntry(prevSeed[index])
          ? prevSeed[index]
          : hasImageEntry(refSeed[index])
            ? refSeed[index]
            : normalizeCombinationImageEntry(prevSeed[index] || refSeed[index]),
      );

      setFormData((prevFormData) => ({
        ...prevFormData,
        combinationImages: next,
      }));

      return next;
    });

    setCombinationImagePreviews((prev) => {
      const prevSeed = Array.isArray(prev) ? prev : [];
      const refSeed = Array.isArray(initialCombinationImagesRef.current)
        ? initialCombinationImagesRef.current
        : [];

      return Array.from({ length: targetLength }, (_, index) => {
        if (Array.isArray(prevSeed[index]) && prevSeed[index].length > 0) {
          return prevSeed[index];
        }

        const entry = refSeed[index];
        if (!Array.isArray(entry)) {
          return [];
        }
        return entry.map((image) => image?.filePath).filter(Boolean);
      });
    });

    setCombinationImageFiles((prev) => {
      const next = {};
      Object.keys(prev).forEach((key) => {
        const numericIndex = Number(key);
        if (!Number.isNaN(numericIndex) && numericIndex < targetLength) {
          next[numericIndex] = prev[key];
        }
      });
      return next;
    });
  }, [combinations]);

  // Handlers

  const handleInputChange = useCallback(
    (e) => {
      const { name, type, checked, value } = e.target;
      setFormData((prev) => {
        // Check if isProductUnique is being updated
        if (name === "isProductUnique") {
          const newValue = type === "checkbox" ? checked : value;
          const newFormData = {
            ...prev,
            [name]: newValue,
          };

          // Regenerate combinations if isProductUnique is updated
          const updatedOptionsArrays = Object.values(newFormData.options).map(
            (option) =>
              option.attr
                .map((opt) => opt.value)
                .filter((value) => value !== ""),
          );
          const combinedOptions = combineMultipleOptions(
            ...updatedOptionsArrays,
          );

          // Reset cost, price, quantity, and warehouse arrays to empty arrays
          const newSku = [];
          const newCost = [];
          const newPrice = [];
          const newWarehouse = [];

          const newQuantity = newValue
            ? Array(combinedOptions.length).fill(1)
            : [];

          // Update state
          setSku(newSku);
          setPrice(newPrice);
          setCost(newCost);
          setQuantity(newQuantity);
          setWarehouse(newWarehouse);

          return {
            ...newFormData,
            combinations: combinedOptions,
            sku: newSku,
            cost: newCost,
            price: newPrice,
            quantity: newQuantity,
            warehouse: newWarehouse,
          };
        }
        return {
          ...prev,
          [name]: type === "checkbox" ? checked : value,
        };
      });
    },
    [combineMultipleOptions, combinations],
  );

  // Handle Blur on Attribute Inputs
  const handleBlur = useCallback(
    (e, index) => {
      const { value } = e.target;
      const updatedAttributes = [...attributes];
      updatedAttributes[index] = value;
      setAttributes(updatedAttributes);
      setFormData((prev) => ({
        ...prev,
        attributes: updatedAttributes,
      }));
    },
    [attributes],
  );

  // Handle Key Press in Options Inputs
  const handleKeyPress = useCallback((e, attrIndex) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const inputValue = e.target.value.trim();
      if (inputValue === "") return;

      // Check for forbidden characters ("/" or "-")
      if (inputValue === "" || /[\/-]/.test(inputValue)) {
        toast.error('Please remove characters for "-" or "/"');
        return;
      }

      // Clear input field
      e.target.value = "";

      setOptions((prevOptions) => {
        const newOptions = JSON.parse(JSON.stringify(prevOptions));
        newOptions[attrIndex].attr.push({
          value: inputValue,
          showInput: false,
        });

        // Also update formData here
        setFormData((prev) => ({
          ...prev,
          options: newOptions,
        }));

        return newOptions;
      });
    }
  }, []);

  // Handle Adding a New Attribute
  const handleAddAttribute = useCallback(() => {
    setAttributes((prev) => [...prev, ""]);
    setOptions((prevOptions) => ({
      ...prevOptions,
      [attributes.length]: {
        attr: [{ value: "", showInput: true }],
      },
    }));
  }, [attributes.length]);

  // Handle Deleting an Attribute
  const handleDeleteAttribute = useCallback(
    (index) => {
      // Step 1: Remove the attribute
      const updatedAttributes = [...attributes];
      updatedAttributes.splice(index, 1);
      setAttributes(updatedAttributes);

      // Step 2: Remove the corresponding options for the deleted attribute
      const updatedOptions = { ...options };
      delete updatedOptions[index];

      // Step 3: Re-index the remaining options to ensure proper mapping
      const reorderedOptions = {};
      Object.keys(updatedOptions).forEach((key) => {
        const newKey = key > index ? key - 1 : key; // Shift the keys after the deleted one
        reorderedOptions[newKey] = updatedOptions[key];
      });
      setOptions(reorderedOptions);

      // Step 4: Re-generate combinations based on the remaining options
      const updatedOptionsArrays = Object.values(reorderedOptions).map(
        (option) =>
          option.attr.map((opt) => opt.value).filter((value) => value !== ""),
      );
      const newCombinations = combineMultipleOptions(...updatedOptionsArrays);

      // Re-generate SKUs based on the new combinations
      const newSku = newCombinations.map((combination) =>
        generateSKU(formData.groupName, combination),
      );

      // Step 5: Update SKU, Price, Cost, Warehouse based on the new combinations
      const newPrice = price.slice(0, newCombinations.length);
      const newCost = cost.slice(0, newCombinations.length);
      const newWarehouse = warehouse.slice(0, newCombinations.length);

      // Step 6: Update state
      setCombinations(newCombinations);
      setSku(newSku);
      setPrice(newPrice);
      setCost(newCost);
      setWarehouse(newWarehouse);

      // Step 7: Update formData accordingly
      setFormData((prev) => ({
        ...prev,
        attributes: updatedAttributes,
        options: reorderedOptions,
        combinations: newCombinations,
        sku: newSku,
        price: newPrice,
        cost: newCost,
        warehouse: newWarehouse,
      }));
    },
    [attributes, options, sku, price, cost, warehouse, combineMultipleOptions],
  );

  // Handle Removing an Option Item
  const handleRemoveItem = useCallback(
    (attrIndex, optionIndex) => {
      setOptions((prevOptions) => {
        const newOptions = JSON.parse(JSON.stringify(prevOptions));
        newOptions[attrIndex].attr.splice(optionIndex, 1);

        // Recalculate combinations based on the updated options
        const updatedOptionsArrays = Object.values(newOptions).map((option) =>
          option.attr.map((opt) => opt.value).filter((value) => value !== ""),
        );
        const newCombinations = combineMultipleOptions(...updatedOptionsArrays);

        // Regenerate SKUs based on new combinations
        const newSku = newCombinations.map((combination) =>
          generateSKU(formData.groupName, combination),
        );

        // Adjust other arrays to match new combinations length
        const newPrice = price.slice(0, newCombinations.length);
        const newCost = cost.slice(0, newCombinations.length);
        const newWarehouse = warehouse.slice(0, newCombinations.length);
        const newQuantity = quantity.slice(0, newCombinations.length);

        // Update all related state
        setCombinations(newCombinations);
        setSku(newSku);
        setPrice(newPrice);
        setCost(newCost);
        setWarehouse(newWarehouse);
        setQuantity(newQuantity);

        // Update formData with all changes
        setFormData((prev) => ({
          ...prev,
          options: newOptions,
          combinations: newCombinations,
          sku: newSku,
          price: newPrice,
          cost: newCost,
          warehouse: newWarehouse,
          quantity: newQuantity,
        }));

        return newOptions;
      });
    },
    [
      combineMultipleOptions,
      formData.groupName,
      price,
      cost,
      warehouse,
      quantity,
    ],
  );

  // Handle Deleting a Combination
  const handleDeleteCombination = (combination) => {
    const index = combinations.indexOf(combination);

    if (index === -1) return;

    // Remove the combination from the list
    const newCombinations = combinations.filter((_, i) => i !== index);

    // Remove the corresponding values from SKU, Price, Cost, and Warehouse arrays
    const newSku = sku.filter((_, i) => i !== index);
    const newPrice = price.filter((_, i) => i !== index);
    const newCost = cost.filter((_, i) => i !== index);
    const newWarehouse = warehouse.filter((_, i) => i !== index);
    const newQuantity = quantity.filter((_, i) => i !== index);
    const newCombinationImages = combinationImages.filter(
      (_, i) => i !== index,
    );
    const newCombinationImagePreviews = combinationImagePreviews.filter(
      (_, i) => i !== index,
    );

    const updatedCombinationImageFiles = {};
    Object.entries(combinationImageFiles).forEach(([key, value]) => {
      const numericIndex = Number(key);
      if (numericIndex < index) {
        updatedCombinationImageFiles[numericIndex] = value;
      }
      if (numericIndex > index) {
        updatedCombinationImageFiles[numericIndex - 1] = value;
      }
    });

    // Update options based on the new combination list if isProductUnique is true
    const newOptions = formData.isProductUnique
      ? removeFromCombined(options, combination, index)
      : options;

    // Update state
    setSku(newSku);
    setPrice(newPrice);
    setCost(newCost);
    setQuantity(newQuantity);
    setWarehouse(newWarehouse);
    setCombinations(newCombinations);
    setOptions(newOptions);
    setCombinationImages(newCombinationImages);
    setCombinationImagePreviews(newCombinationImagePreviews);
    setCombinationImageFiles(updatedCombinationImageFiles);

    // Update formData
    setFormData((prevFormData) => ({
      ...prevFormData,
      combinations: newCombinations,
      sku: newSku,
      price: newPrice,
      cost: newCost,
      quantity: newQuantity,
      warehouse: newWarehouse,
      options: newOptions,
      combinationImages: newCombinationImages,
    }));
  };

  // Handle Setting Combination Name
  const handleSetCombinationName = useCallback(
    (e, index) => {
      const updatedCombinations = [...combinations];
      updatedCombinations[index] = e.target.value;
      setCombinations(updatedCombinations);
      setFormData((prev) => ({
        ...prev,
        combinations: updatedCombinations,
      }));
    },
    [combinations],
  );

  // Handle SKU Change
  const handleSkuChange = useCallback(
    (e, index) => {
      const updatedSku = [...sku];
      updatedSku[index] = e.target.value;
      setSku(updatedSku);
      setFormData((prev) => ({
        ...prev,
        sku: updatedSku,
      }));
    },
    [sku],
  );

  // Handle Price Change
  const handlePriceChange = useCallback(
    (e, index) => {
      const { value } = e.target;
      const regex = /^[0-9]*$/; // Only allow numbers
      if (regex.test(value)) {
        const updatedPrice = [...price];
        updatedPrice[index] = value;
        setPrice(updatedPrice);
        setFormData((prev) => ({
          ...prev,
          price: updatedPrice,
        }));
      } else {
        toast.error("Only numbers are allowed.");
        e.target.value = "";
      }
    },
    [price],
  );

  // Handle Quantity Change
  const handleQuantityChange = useCallback(
    (e, index) => {
      const { value } = e.target;
      const regex = /^[0-9]*$/;

      if (regex.test(value)) {
        const updatedQuantity = [...quantity];
        updatedQuantity[index] = value;

        setQuantity(updatedQuantity);
        setFormData((prev) => ({
          ...prev,
          quantity: updatedQuantity,
        }));
      } else {
        toast.error("Only numbers are allowed.");
        e.target.value = ""; // Reset the field if invalid
      }
    },
    [quantity],
  );

  // Handle Cost Change
  const handleCostChange = useCallback(
    (e, index) => {
      const { value } = e.target;
      const regex = /^[0-9]*$/; // Only allow numbers
      if (regex.test(value)) {
        const updatedCost = [...cost];
        updatedCost[index] = value;
        setCost(updatedCost);
        setFormData((prev) => ({
          ...prev,
          cost: updatedCost,
        }));
      } else {
        toast.error("Only numbers are allowed.");
        e.target.value = "";
      }
    },
    [cost],
  );

  // Handle Warehouse Change
  const handleWarehouseChange = useCallback(
    (e, index) => {
      const updatedWarehouse = [...warehouse];
      updatedWarehouse[index] = e.target.value;
      setWarehouse(updatedWarehouse);
      setFormData((prev) => ({
        ...prev,
        warehouse: updatedWarehouse,
      }));
    },
    [warehouse],
  );

  // Handle Copy SKU to All
  const handleCopySkuToAll = useCallback(() => {
    const updatedSku = combinations.map((comb) =>
      generateSKU(formData.groupName, comb),
    );
    setSku(updatedSku);
    setFormData((prev) => ({
      ...prev,
      sku: updatedSku,
    }));
  }, [combinations, formData.groupName]);

  const handleCopyQuantityToAll = useCallback(() => {
    if (quantity.length === 0) return;
    const baseQuantity = quantity[0];
    const updatedQuantity = combinations.map(() => baseQuantity);
    setQuantity(updatedQuantity);
    setFormData((prev) => ({
      ...prev,
      quantity: updatedQuantity,
    }));
  }, [combinations, quantity]);

  // Handle Copy Cost to All
  const handleCopyCostToAll = useCallback(() => {
    if (cost.length === 0) return;
    const baseCost = cost[0];
    const updatedCost = combinations.map(() => baseCost);
    setCost(updatedCost);
    setFormData((prev) => ({
      ...prev,
      cost: updatedCost,
    }));
  }, [combinations, cost]);

  // Handle Copy Price to All
  const handleCopyPriceToAll = useCallback(() => {
    if (price.length === 0) return;
    const basePrice = price[0];
    const updatedPrice = combinations.map(() => basePrice);
    setPrice(updatedPrice);
    setFormData((prev) => ({
      ...prev,
      price: updatedPrice,
    }));
  }, [combinations, price]);

  // Handle Copy Warehouse to All
  const handleCopyWarehouseToAll = useCallback(() => {
    if (warehouse.length === 0) return;
    const baseWarehouse = warehouse[0];
    const updatedWarehouse = combinations.map(() => baseWarehouse);
    setWarehouse(updatedWarehouse);
    setFormData((prev) => ({
      ...prev,
      warehouse: updatedWarehouse,
    }));
  }, [combinations, warehouse]);

  // Handle Branch Selection
  const handleBranchChange = useCallback((branchId, isChecked) => {
    if (isChecked) {
      setSelectedBranches((prev) => [...prev, branchId]);
    } else {
      setSelectedBranches((prev) => prev.filter((id) => id !== branchId));
    }
  }, []);

  // Handle Quantity Distribution Change
  const handleQuantityDistributionChange = useCallback((value) => {
    setQuantityDistribution(value);
    if (value === "split") {
      const totalQty = parseInt(formData.quantity[0] || 0, 10);
      const perBranch = Math.floor(totalQty / selectedBranches.length);
      const newBranchQuantities = {};
      selectedBranches.forEach((branchId) => {
        newBranchQuantities[branchId] = perBranch;
      });
      setBranchQuantities(newBranchQuantities);
    } else {
      setBranchQuantities({});
    }
  }, [selectedBranches, formData.quantity]);

  // Handle Branch Quantity Change
  const handleBranchQuantityChange = useCallback((branchId, quantity) => {
    setBranchQuantities((prev) => ({
      ...prev,
      [branchId]: quantity,
    }));
  }, []);

  // console.log("Formdata Used", formData);

  // Save Product Group
  const saveProductGroup = useCallback(
    async (e) => {
      e.preventDefault();

      const { isValid, errors } = validateFormData(formData, setFormData);

      console.log("errors", errors);

      // If validation fails, show errors and stop the process
      if (!isValid) {
        console.error("Validation errors:", errors);
        Object.values(errors).forEach((error) => toast.error(error));
        return;
      }

      // Validate branch selection for add mode
      if (mode === "add" && selectedBranches.length === 0) {
        toast.error("Please select at least one branch");
        return;
      }

      const formDataToSend = new FormData();

      formDataToSend.append("groupName", formData.groupName);
      formDataToSend.append("category", formData.category);
      formDataToSend.append("description", formData.description);
      formDataToSend.append(
        "isProductUnique",
        JSON.stringify(formData.isProductUnique),
      );

      // Add branch selection data for add mode
      if (mode === "add") {
        formDataToSend.append("selectedBranches", JSON.stringify(selectedBranches));
        formDataToSend.append("quantityDistribution", quantityDistribution);
        if (quantityDistribution === "split") {
          formDataToSend.append("branchQuantities", JSON.stringify(branchQuantities));
        }
      }

      // For quantity in add mode with split distribution, send combined quantity
      let quantityToSend = formData.quantity;
      if (mode === "add" && quantityDistribution === "split") {
        // Calculate total quantity from branch quantities
        quantityToSend = formData.quantity.map((_, index) => {
          const branchQtys = Object.values(branchQuantities);
          if (branchQtys.length > 0) {
            return branchQtys.reduce((sum, qty) => sum + (Array.isArray(qty) ? qty[index] || 0 : qty), 0);
          }
          return 0;
        });
      } else if (mode === "add") {
        // For "same" distribution, multiply by number of branches
        quantityToSend = formData.quantity.map((qty) => qty * selectedBranches.length);
      }

      formDataToSend.append("cost", JSON.stringify(formData.cost));
      formDataToSend.append("price", JSON.stringify(formData.price));
      formDataToSend.append("sku", JSON.stringify(formData.sku));
      formDataToSend.append("quantity", JSON.stringify(quantityToSend));

      formDataToSend.append("warehouse", JSON.stringify(formData.warehouse));
      formDataToSend.append("attributes", JSON.stringify(formData.attributes));
      formDataToSend.append(
        "combinations",
        JSON.stringify(formData.combinations),
      );
      formDataToSend.append(
        "combinationImages",
        JSON.stringify(combinationImages),
      );
      formDataToSend.append(
        "listingOptions",
        JSON.stringify(
          Array.isArray(formData.listingOptions) ? formData.listingOptions : [],
        ),
      );

      // For options object
      formDataToSend.append("options", JSON.stringify(formData.options));
      const existingImages = groupImageItems
        .filter((item) => item.existing && item.image)
        .map((item) => item.image);

      formDataToSend.append("existingImages", JSON.stringify(existingImages));

      groupImageItems
        .filter((item) => item.file)
        .forEach((item) => {
          formDataToSend.append("image", item.file);
        });

      Object.entries(combinationImageFiles).forEach(([index, files]) => {
        (Array.isArray(files) ? files : []).forEach((file) => {
          formDataToSend.append(`combinationImages_${index}`, file);
        });
      });

      // Save Logic
      try {
        if (mode === "add") {
          await dispatch(createMultipleProducts(formDataToSend));
          toast.success("Product group added successfully!");
          navigate("/inventory/product-groups");
        } else if (mode === "edit") {
          await dispatch(updateProductGroup({ id, formData: formDataToSend }));
          toast.success("Product group updated successfully!");
          navigate(`/inventory/product-group/${id}`);
        }
      } catch (error) {
        toast.error("An error occurred while saving the product group.");
        console.error(error);
      }
    },
    [
      formData,
      dispatch,
      navigate,
      mode,
      id,
      options,
      groupImageItems,
      combinationImages,
      combinationImageFiles,
      selectedBranches,
      quantityDistribution,
      branchQuantities,
    ],
  );

  const focusInput = useCallback((ref) => {
    ref?.current?.focus();
  }, []);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems = files.map((file, index) => ({
      id: `new-group-${Date.now()}-${index}-${file.name}`,
      file,
      previewUrl: URL.createObjectURL(file),
      existing: false,
    }));

    setGroupImageItems((prev) => [...prev, ...newItems]);
    setActiveGroupImageId(newItems[newItems.length - 1].id);
    e.target.value = "";
  };

  const handleSelectGroupImage = useCallback((imageId) => {
    setActiveGroupImageId(imageId);
  }, []);

  const handleDeleteGroupImage = useCallback(
    (imageId) => {
      setGroupImageItems((prev) => {
        const target = prev.find((item) => item.id === imageId);
        if (target?.previewUrl && target?.existing === false) {
          URL.revokeObjectURL(target.previewUrl);
        }

        const next = prev.filter((item) => item.id !== imageId);
        if (activeGroupImageId === imageId) {
          setActiveGroupImageId(next[next.length - 1]?.id || null);
        }

        return next;
      });
    },
    [activeGroupImageId],
  );

  const handleCombinationImageChange = useCallback((e, index) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setCombinationImageFiles((prev) => ({
      ...prev,
      [index]: files,
    }));

    setCombinationImagePreviews((prev) => {
      const updated = [...prev];
      updated[index] = files.map((file) => URL.createObjectURL(file));
      return updated;
    });

    setCombinationImages((prev) => {
      const updated = [...prev];
      const existing = Array.isArray(updated[index]) ? updated[index] : [];
      updated[index] = [...existing];

      setFormData((prevFormData) => ({
        ...prevFormData,
        combinationImages: updated,
      }));

      return updated;
    });
  }, []);

  return {
    // States
    isLoading,
    admin,
    currentUser,
    formData,
    attributes,
    combinations,
    sku,
    price,
    quantity,
    warehouse,
    cost,
    options,
    inputRefs,
    groupImageItems,
    activeGroupImageId,
    combinationImagePreviews,
    selectedBranches,
    quantityDistribution,
    branchQuantities,
    allAvailableStores,

    // Handlers
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
    handleBranchChange,
    handleQuantityDistributionChange,
    handleBranchQuantityChange,
  };
};

export default useProductGroup;
