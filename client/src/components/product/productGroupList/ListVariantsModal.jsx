import React, { useMemo, useState } from "react";
import "./ListVariantsModal.css";

const parseVariantOptions = (variantName = "") => {
  if (typeof variantName !== "string") return [];
  const [, optionsPart = ""] = variantName.split(" - ");
  return optionsPart
    .split("/")
    .map((value) => value.trim())
    .filter(Boolean);
};

const buildAttributeOptionGroups = (group = {}) => {
  const attributes = Array.isArray(group?.attributes) ? group.attributes : [];
  const options = group?.options || {};

  return attributes.map((attribute, index) => {
    const optionGroup = options?.[index];
    const values = Array.isArray(optionGroup?.attr)
      ? [...new Set(
          optionGroup.attr
            .map((item) =>
              typeof item?.value === "string" ? item.value.trim() : "",
            )
            .filter(Boolean),
        )]
      : [];

    return {
      attribute,
      attributeIndex: index,
      values,
    };
  });
};

const sanitizeExistingListingOptions = (listingOptions = [], optionGroups = []) => {
  const groupMap = new Map(optionGroups.map((group) => [group.attributeIndex, group]));

  return (Array.isArray(listingOptions) ? listingOptions : [])
    .map((entry) => {
      const attributeIndex = Number(entry?.attributeIndex);
      if (Number.isNaN(attributeIndex)) return null;

      const targetGroup = groupMap.get(attributeIndex);
      if (!targetGroup) return null;

      const options = Array.isArray(entry?.options)
        ? entry.options.filter((value) => targetGroup.values.includes(value))
        : [];

      if (options.length === 0) return null;

      return {
        attribute: targetGroup.attribute,
        attributeIndex,
        options: [...new Set(options)],
      };
    })
    .filter(Boolean);
};

const deriveListingOptionsFromListedVariants = (
  optionGroups = [],
  variants = [],
  listedIds = [],
) => {
  const listedSet = new Set(listedIds);
  const listedVariants = (Array.isArray(variants) ? variants : []).filter((variant) =>
    listedSet.has(variant?._id),
  );

  if (listedVariants.length === 0) {
    return [];
  }

  return optionGroups
    .map((group) => {
      const options = listedVariants
        .map((variant) => parseVariantOptions(variant?.name)[group.attributeIndex])
        .filter((value) => group.values.includes(value));

      const uniqueOptions = [...new Set(options)];
      if (uniqueOptions.length === 0) return null;

      return {
        attribute: group.attribute,
        attributeIndex: group.attributeIndex,
        options: uniqueOptions,
      };
    })
    .filter(Boolean);
};

const ListVariantsModal = ({
  groupName,
  group,
  variants,
  initialSelectedIds = [],
  onConfirm,
  onClose,
}) => {
  const [selectedIds, setSelectedIds] = useState(initialSelectedIds);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectableVariants = useMemo(() => {
    return Array.isArray(variants) ? variants : [];
  }, [variants]);

  const attributeOptionGroups = useMemo(
    () => buildAttributeOptionGroups(group),
    [group],
  );

  const initialListingOptions = useMemo(() => {
    const sanitized = sanitizeExistingListingOptions(
      group?.listingOptions,
      attributeOptionGroups,
    );

    if (sanitized.length > 0) {
      return sanitized;
    }

    return deriveListingOptionsFromListedVariants(
      attributeOptionGroups,
      selectableVariants,
      initialSelectedIds,
    );
  }, [
    group?.listingOptions,
    attributeOptionGroups,
    selectableVariants,
    initialSelectedIds,
  ]);

  const [listingSelection, setListingSelection] = useState(() => {
    return initialListingOptions.reduce((acc, entry) => {
      acc[entry.attributeIndex] = entry.options;
      return acc;
    }, {});
  });

  const publishedOptions = useMemo(() => {
    return attributeOptionGroups
      .map((groupOption) => {
        const selected = Array.isArray(listingSelection[groupOption.attributeIndex])
          ? listingSelection[groupOption.attributeIndex]
          : [];

        if (selected.length === 0) return null;

        return {
          attribute: groupOption.attribute,
          attributeIndex: groupOption.attributeIndex,
          options: selected,
        };
      })
      .filter(Boolean);
  }, [attributeOptionGroups, listingSelection]);

  const hasPublishedOptions = publishedOptions.length > 0;

  const matchedVariantIds = useMemo(() => {
    if (!hasPublishedOptions) return [];

    return selectableVariants
      .filter((variant) => {
        if (!variant?.listable) return false;

        const variantOptions = parseVariantOptions(variant?.name);

        return publishedOptions.every((entry) => {
          const optionValue = variantOptions[entry.attributeIndex];
          return entry.options.includes(optionValue);
        });
      })
      .map((variant) => variant._id);
  }, [selectableVariants, hasPublishedOptions, publishedOptions]);

  const effectiveSelectedIds = hasPublishedOptions ? matchedVariantIds : selectedIds;

  const toggleSelection = (variantId, isDisabled) => {
    if (isDisabled || hasPublishedOptions) return;
    setSelectedIds((prev) =>
      prev.includes(variantId)
        ? prev.filter((id) => id !== variantId)
        : [...prev, variantId],
    );
  };

  const togglePublishedOption = (attributeIndex, optionValue) => {
    setListingSelection((prev) => {
      const existing = Array.isArray(prev[attributeIndex])
        ? prev[attributeIndex]
        : [];
      const exists = existing.includes(optionValue);
      const nextValues = exists
        ? existing.filter((value) => value !== optionValue)
        : [...existing, optionValue];

      return {
        ...prev,
        [attributeIndex]: nextValues,
      };
    });
  };

  const clearPublishedOptions = () => {
    setListingSelection({});
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm({
        selectedIds: effectiveSelectedIds,
        publishedOptions,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="list-variants-modal">
      <div className="list-variants-header">
        <h4>List or unlist items</h4>
        <p>Select the variants you want listed for {groupName}.</p>
      </div>
      {!!attributeOptionGroups.length && (
        <div className="published-options-section">
          <div className="published-options-header">
            <h5>Publish options for listing</h5>
            <button
              type="button"
              className="published-options-clear"
              onClick={clearPublishedOptions}
              disabled={isSubmitting}
            >
              Clear
            </button>
          </div>
          {attributeOptionGroups.map((groupOption) => (
            <div key={groupOption.attributeIndex} className="published-option-group">
              <span className="published-option-label">{groupOption.attribute}</span>
              <div className="published-option-values">
                {groupOption.values.map((value) => {
                  const isSelected = Array.isArray(
                    listingSelection[groupOption.attributeIndex],
                  )
                    ? listingSelection[groupOption.attributeIndex].includes(value)
                    : false;

                  return (
                    <button
                      key={`${groupOption.attributeIndex}-${value}`}
                      type="button"
                      className={`published-option-chip ${
                        isSelected ? "published-option-chip--active" : ""
                      }`}
                      onClick={() =>
                        togglePublishedOption(groupOption.attributeIndex, value)
                      }
                      disabled={isSubmitting}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {hasPublishedOptions && (
            <p className="published-options-note">
              Published options are active. A variant is auto-selected only if it matches your selected options for every published attribute.
            </p>
          )}
        </div>
      )}
      <div className="list-variants-body">
        {selectableVariants.map((variant) => {
          const isSelected = effectiveSelectedIds.includes(variant._id);
          const isDisabled = !variant.listable;

          return (
            <label
              key={variant._id}
              className={`variant-row ${
                isDisabled ? "variant-row--disabled" : ""
              } ${isSelected ? "variant-row--selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isDisabled || isSubmitting || hasPublishedOptions}
                onChange={() => toggleSelection(variant._id, isDisabled)}
              />
              <div className="variant-meta">
                <span className="variant-name">{variant.name}</span>
                <span
                  className={`variant-pill ${
                    variant.listable ? "variant-pill--ok" : "variant-pill--bad"
                  }`}
                >
                  {variant.listable
                    ? `${variant.combinedCount} images`
                    : `Needs ${2 - variant.combinedCount} more image${
                        2 - variant.combinedCount === 1 ? "" : "s"
                      }`}
                </span>
              </div>
            </label>
          );
        })}
      </div>
      <div className="list-variants-footer">
        <button
          type="button"
          className="list-variants-cancel"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="list-variants-primary"
          onClick={handleConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Updating..." : "Update listing"}
        </button>
      </div>
    </div>
  );
};

export default ListVariantsModal;
