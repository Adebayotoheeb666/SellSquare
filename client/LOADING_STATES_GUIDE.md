# Loading States Implementation Guide

## Overview

This guide shows how to add loading states with spinners to buttons throughout the app to prevent double submissions and provide visual feedback.

## Components Created

### 1. ButtonSpinner Component

**Location:** `client/src/components/loader/ButtonSpinner.js`

A small SVG spinner that can be used inline with button text.

**Usage:**

```jsx
import ButtonSpinner from "../../components/loader/ButtonSpinner";

<button disabled={isLoading}>
  {isLoading && <ButtonSpinner />}
  Submit
</button>;
```

**Props:**

- `size` (optional): Size of the spinner (default: "16px")
- `color` (optional): Color of the spinner (default: "currentColor")

### 2. useAsyncButton Hook

**Location:** `client/src/customHook/useAsyncButton.js`

Custom hooks for managing async button states.

#### useAsyncButton (Single Button)

For components with one main async action:

```jsx
import { useAsyncButton } from "../../customHook/useAsyncButton";
import ButtonSpinner from "../../components/loader/ButtonSpinner";

const MyComponent = () => {
  const { isLoading, execute } = useAsyncButton();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await execute(async () => {
      // Your async operation
      await dispatch(someAction(formData));
    });
  };

  return (
    <button onClick={handleSubmit} disabled={isLoading}>
      {isLoading && <ButtonSpinner />}
      Submit
    </button>
  );
};
```

#### useAsyncButtons (Multiple Buttons)

For components with multiple async actions:

```jsx
import { useAsyncButtons } from "../../customHook/useAsyncButton";
import ButtonSpinner from "../../components/loader/ButtonSpinner";

const MyComponent = () => {
  const { isLoading, execute } = useAsyncButtons();

  const handleSave = async () => {
    await execute("save", async () => {
      await dispatch(saveAction(data));
    });
  };

  const handleDelete = async (id) => {
    await execute(`delete-${id}`, async () => {
      await dispatch(deleteAction(id));
    });
  };

  return (
    <>
      <button onClick={handleSave} disabled={isLoading("save")}>
        {isLoading("save") && <ButtonSpinner />}
        Save
      </button>

      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => handleDelete(item.id)}
          disabled={isLoading(`delete-${item.id}`)}
        >
          {isLoading(`delete-${item.id}`) && <ButtonSpinner />}
          Delete
        </button>
      ))}
    </>
  );
};
```

## Implementation Pattern

### Step 1: Import Required Components

```jsx
import { useAsyncButtons } from "../../customHook/useAsyncButton";
import ButtonSpinner from "../../components/loader/ButtonSpinner";
```

### Step 2: Initialize Hook

```jsx
const MyComponent = () => {
  const { isLoading, execute } = useAsyncButtons();
  // ... rest of component
};
```

### Step 3: Wrap Async Functions

```jsx
// Before:
const handleDelete = async (id) => {
  await dispatch(deleteProduct(id));
  await dispatch(getProducts());
};

// After:
const handleDelete = async (id) => {
  await execute(`delete-${id}`, async () => {
    await dispatch(deleteProduct(id));
    await dispatch(getProducts());
  });
};
```

### Step 4: Update Button/Link JSX

```jsx
// Before:
<button onClick={() => handleDelete(id)}>Delete</button>

// After:
<button
  onClick={() => handleDelete(id)}
  disabled={isLoading(`delete-${id}`)}
>
  {isLoading(`delete-${id}`) && <ButtonSpinner />}
  Delete
</button>
```

## Components Already Updated

### ✅ ProductForm

- Add/Edit Product submit button
- Loading state prevents double submission
- Spinner shows during save

### ✅ ProductGroupForm

- Add/Edit Product Group submit button
- Loading state with spinner
- Prevents double submission

### ✅ ProductList

- Delete product buttons
- Add to cart buttons
- Modal add to cart button
- Individual loading states per product

### ✅ NewSalesList

- Send receipt email
- Verify email
- Update delivery status
- Share receipt

## Components To Update

### High Priority (User-Facing Actions)

#### Authentication Forms

- **Login.js** - Login button
- **Register.js** - Register button
- **Forgot.js** - Reset password request button
- **Reset.js** - Reset password button
- **ChangePassword** - Change password button

#### Product Management

- **ProductGroupList** - Delete group buttons
- **outOfStockList** - Delete buttons
- **EditProduct** - Update button
- **EditProductGroup** - Update button

#### Business/Admin

- **Admin.jsx** - Update subscription button
- **BusinessSummary** - Update business info button
- **Profile** - Update profile button

#### Customer Management

- **Customers.jsx** - Send message buttons

#### Blog/Web

- **Blog.jsx** - Create/Edit/Delete post buttons
- **BlogPost.jsx** - Edit/Delete buttons
- **Contact.jsx** - Submit form button

#### Marketplace

- **ProductDetail.jsx** - Add to cart, Buy now buttons
- **Cart.jsx** - Update quantity, Remove item buttons

### Medium Priority (Less Frequent Actions)

- Fulfilment update payment buttons
- Return function buttons
- Draft save buttons
- Payment update buttons

## Example Implementations

### Example 1: Simple Form Submit

```jsx
import { useAsyncButton } from "../../customHook/useAsyncButton";
import ButtonSpinner from "../../components/loader/ButtonSpinner";

const LoginForm = () => {
  const { isLoading, execute } = useAsyncButton();
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    await execute(async () => {
      await dispatch(loginUser(formData));
      navigate('/dashboard');
    });
  };

  return (
    <form onSubmit={handleLogin}>
      <input type="email" value={formData.email} onChange={...} />
      <input type="password" value={formData.password} onChange={...} />
      <button type="submit" disabled={isLoading}>
        {isLoading && <ButtonSpinner />}
        Login
      </button>
    </form>
  );
};
```

### Example 2: Multiple Buttons in List

```jsx
import { useAsyncButtons } from "../../customHook/useAsyncButton";
import ButtonSpinner from "../../components/loader/ButtonSpinner";

const BlogList = ({ posts }) => {
  const { isLoading, execute } = useAsyncButtons();

  const handleDelete = async (postId) => {
    await execute(`delete-${postId}`, async () => {
      await dispatch(deletePost(postId));
      await dispatch(getPosts());
    });
  };

  return (
    <div>
      {posts.map((post) => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          <button
            onClick={() => handleDelete(post.id)}
            disabled={isLoading(`delete-${post.id}`)}
          >
            {isLoading(`delete-${post.id}`) && <ButtonSpinner />}
            Delete
          </button>
        </div>
      ))}
    </div>
  );
};
```

### Example 3: Links/Anchors

```jsx
<a
  onClick={buttonLoading("action") ? undefined : handleAction}
  style={{
    opacity: buttonLoading("action") ? 0.6 : 1,
    cursor: buttonLoading("action") ? "not-allowed" : "pointer",
    pointerEvents: buttonLoading("action") ? "none" : "auto",
  }}
>
  {buttonLoading("action") && <ButtonSpinner size="12px" />}
  {buttonLoading("action") ? "Processing..." : "Click Here"}
</a>
```

### Example 4: Confirm Alert (react-confirm-alert)

```jsx
import { useAsyncButtons } from "../../customHook/useAsyncButton";

const MyComponent = () => {
  const { isLoading, execute } = useAsyncButtons();

  const handleDelete = async (id) => {
    await execute(`delete-${id}`, async () => {
      await dispatch(deleteItem(id));
      await dispatch(getItems());
    });
  };

  const confirmDelete = (id) => {
    if (isLoading(`delete-${id}`)) return; // Prevent opening during deletion

    confirmAlert({
      title: "Confirm Delete",
      message: "Are you sure?",
      buttons: [
        {
          label: "Yes, Delete",
          onClick: () => handleDelete(id),
        },
        {
          label: "Cancel",
        },
      ],
    });
  };

  return (
    <button onClick={() => confirmDelete(itemId)}>
      {isLoading(`delete-${itemId}`) ? "Deleting..." : "Delete"}
    </button>
  );
};
```

## Best Practices

1. **Unique Keys**: Use unique identifiers for each button action

   ```jsx
   execute(`action-${uniqueId}`, asyncFn);
   ```

2. **Prevent Double Click**: Always disable button when loading

   ```jsx
   <button disabled={isLoading('key')}>
   ```

3. **Visual Feedback**: Always show spinner during loading

   ```jsx
   {
     isLoading("key") && <ButtonSpinner />;
   }
   ```

4. **Error Handling**: Let Redux/async functions handle errors

   ```jsx
   // Errors handled by dispatch or caught in component
   await execute("key", async () => {
     await dispatch(action()); // This handles its own errors
   });
   ```

5. **Loading Text**: Change button text during loading

   ```jsx
   {
     isLoading("save") ? "Saving..." : "Save";
   }
   ```

6. **Form Prevention**: Prevent form submission when loading
   ```jsx
   const handleSubmit = async (e) => {
     e.preventDefault();
     if (isLoading('submit')) return;
     await execute('submit', async () => {...});
   };
   ```

## Testing Checklist

For each updated component, verify:

- [ ] Button shows spinner during async operation
- [ ] Button is disabled during async operation
- [ ] Multiple clicks don't trigger multiple requests
- [ ] Button text changes appropriately (e.g., "Saving...")
- [ ] Spinner disappears when operation completes
- [ ] Error states still work correctly
- [ ] Success states still work correctly

## Styling Tips

The ButtonSpinner uses `currentColor`, so it inherits the button's text color:

```scss
button {
  color: #fff; // Spinner will be white

  &:disabled {
    opacity: 0.6; // Dimmed when disabled
    cursor: not-allowed;
  }
}
```

For custom spinner colors:

```jsx
<ButtonSpinner color="#4caf50" size="18px" />
```

## Migration Checklist

1. Install components:

   - ✅ ButtonSpinner.js
   - ✅ ButtonSpinner.scss
   - ✅ useAsyncButton.js

2. Update critical components (High Priority):

   - ✅ ProductForm
   - ✅ ProductGroupForm
   - ✅ ProductList
   - ✅ NewSalesList
   - ⏳ Login
   - ⏳ Register
   - ⏳ Other auth forms
   - ⏳ Delete operations
   - ⏳ Update operations

3. Update secondary components (Medium Priority)
4. Test all updated components
5. Update documentation if needed

## Quick Reference

```jsx
// 1. Import
import { useAsyncButtons } from "../../customHook/useAsyncButton";
import ButtonSpinner from "../../components/loader/ButtonSpinner";

// 2. Initialize
const { isLoading, execute } = useAsyncButtons();

// 3. Wrap async function
const myAction = async (id) => {
  await execute(`action-${id}`, async () => {
    await dispatch(doSomething(id));
  });
};

// 4. Update button
<button onClick={() => myAction(id)} disabled={isLoading(`action-${id}`)}>
  {isLoading(`action-${id}`) && <ButtonSpinner />}
  {isLoading(`action-${id}`) ? "Processing..." : "Click Me"}
</button>;
```
