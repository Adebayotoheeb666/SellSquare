# SELL SQUARE

**Sell Square** is a comprehensive cloud-based inventory and business management platform designed to help small and medium-sized businesses efficiently manage their operations, track sales, and grow their business. Built with modern web technologies, it provides an all-in-one solution for inventory management, sales tracking, customer relationships, and team collaboration.

🌐 **Live Platform:** [sellsquarehub.com](https://www.sellsquarehub.com/)

---

## 🎯 Key Features

### **Inventory Management**
- **Real-time Inventory Tracking** - Monitor stock levels across multiple warehouses in real-time
- **Product Groups & Variants** - Manage products with multiple attributes (size, color, etc.) and auto-generate combinations
- **Automated Stock Valuation** - Automatically calculate inventory value based on cost and quantity
- **Low Stock Alerts** - Track products running out of stock to prevent stockouts
- **Product Image Management** - Upload and manage product images with cloud storage integration
- **Bulk Operations** - Copy SKU, price, cost, and warehouse data across multiple product variants
- **Inventory Synchronization** - Keep digital inventory aligned with physical stock

### **Sales & Checkout**
- **Point of Sale (POS) System** - Fast and intuitive cart-based checkout system
- **Multiple Payment Methods** - Track cash, POS (card), and bank transfer payments
- **Sales Recording** - Comprehensive daily sales tracking with profit calculations
- **Return Management** - Handle product returns and inventory adjustments
- **Receipt Generation** - Auto-generate professional receipts with business branding
- **Receipt Sharing** - Share receipts via email or WhatsApp directly from the platform
- **Draft Orders** - Save incomplete orders and resume later

### **Customer Management**
- **Customer Database** - Maintain detailed customer records and purchase history
- **Debtor Tracking** - Monitor outstanding payments and manage credit sales
- **Customer Communication** - Send messages and receipts directly to customers
- **Purchase History** - View complete customer transaction records

### **Business Analytics & Reporting**
- **Dashboard Overview** - Visual representation of key business metrics
- **Sales Analytics** - Track daily, weekly, and monthly sales performance
- **Profit Tracking** - Monitor profit margins on individual sales and overall business
- **Top Products Report** - Identify best-selling products and trends
- **Monthly Reports** - Automated generation of monthly business summaries
- **Date Range Filtering** - Analyze performance across custom date ranges

### **Team Management & Permissions**
- **Multi-User Access** - Add sales representatives and team members
- **Role-Based Permissions** - Granular control over who can add, edit, delete products, view finances, etc.
- **Activity Logging** - Track all user actions with detailed activity logs
- **Business Activity Timeline** - See who is doing what and when across your business

### **Subscription & Scalability**
- **Flexible Plans** - Free, Basic, Standard, and Professional tiers to match business needs
- **Scalable Team Size** - Add more sales reps as your business grows
- **Grace Period Management** - Continue operations during payment grace periods
- **Feature-Based Access** - Advanced features unlock with higher subscription tiers

### **Multi-Location Support**
- **Warehouse Management** - Organize inventory across multiple physical locations
- **Fulfillment Tracking** - Manage order fulfillment and delivery status
- **Location-Based Inventory** - Track which warehouse holds specific products

### **Communication & Notifications**
- **Email Integration** - Send receipts and notifications via email
- **WhatsApp Integration** - Share receipts and communicate via WhatsApp
- **SMS Notifications** - Send transaction confirmations and updates
- **Toast Notifications** - Real-time in-app notifications with progress tracking

### **Data Management**
- **Cloud Storage** - All data securely stored in the cloud with AWS S3 integration
- **Automated Backups** - Regular backups to prevent data loss
- **Import/Export** - Export reports and data for external analysis
- **File Downloads** - Download receipts, reports, and business documents

### **User Experience**
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices
- **Non-Blocking Operations** - Continue working while background tasks complete
- **Contextual Loading States** - Clear feedback on data loading and processing
- **Search & Filter** - Quickly find products, sales, and customers
- **Pagination** - Efficient browsing of large datasets

### **Security & Authentication**
- **Secure Authentication** - JWT-based authentication with password encryption
- **Business Email Verification** - Verify business ownership through email
- **Password Reset** - Secure password recovery system
- **Session Management** - Automatic session handling and timeout protection
- **Route Protection** - Middleware-based authorization for sensitive operations

### **Additional Features**
- **Blog System** - Share business updates and content with customers
- **Contact Management** - Handle customer inquiries and support requests
- **Marketplace Integration** - Showcase products in online marketplace
- **Product Specifications** - Detailed product descriptions and specifications
- **Dark/Light Mode Support** - User preference-based theme switching

---

## 💡 Business Benefits

### **Efficiency & Productivity**
- Eliminate manual inventory counting and reduce human errors
- Streamline sales process with fast checkout system
- Save time with automated calculations and report generation
- Manage multiple warehouses from a single dashboard

### **Financial Control**
- Real-time visibility into inventory value and profit margins
- Track payment methods to understand cash flow
- Identify profitable products and optimize stock levels
- Monitor outstanding debtor payments

### **Business Growth**
- Scale team size with multi-user support and permissions
- Make data-driven decisions with comprehensive analytics
- Improve customer relationships with purchase history tracking
- Expand to multiple locations seamlessly

### **Customer Satisfaction**
- Professional receipt generation enhances brand image
- Quick checkout process improves customer experience
- Easy returns handling builds customer trust
- Direct communication channels for better engagement

### **Operational Transparency**
- Activity logs provide complete audit trail
- Know exactly who made changes and when
- Monitor team performance and productivity
- Identify process bottlenecks and inefficiencies

### **Cost Savings**
- Cloud-based solution eliminates need for expensive hardware
- Automated processes reduce labor costs
- Prevent stockouts and overstock situations
- Flexible subscription plans match budget constraints

---

## 🧪 Testing

This application has comprehensive automated tests for both frontend and backend to ensure reliability and prevent errors.

### Quick Start

**Backend Tests:**
```bash
npm test                # Run all backend tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report
```

**Frontend Tests:**
```bash
cd client
npm test                # Run all frontend tests
npm run test:coverage   # Generate coverage report
npm run test:ci         # Run tests in CI mode
```

📖 For detailed testing documentation, see [TESTING.md](./TESTING.md)

### Test Coverage

- ✅ Blog Controller (CRUD operations, authentication)
- ✅ Product Controller (inventory management)
- ✅ Auth Middleware (authentication & authorization)
- ✅ Blog Component (UI interactions, delete modal)
- ✅ Cart Component (add, remove, quantity management)
- ✅ Auth Service (login, logout, session management)
- ✅ Integration Tests (API endpoints)

---

## 🚀 Available Scripts

In the project directory, you can run:

### `npm run dev` in the root folder
### `npm start` in the client folder

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

---

## 🛠 Technology Stack

**Frontend:** React, Redux Toolkit, React Router, Sonner (Toast Notifications), Ant Design, Moment.js  
**Backend:** Node.js, Express.js, MongoDB, Mongoose  
**Cloud Services:** AWS S3 (File Storage), Cloudinary (Image Management)  
**Authentication:** JWT (JSON Web Tokens)  
**Email/SMS:** Nodemailer, SMS Gateway Integration  
**Testing:** Jest, React Testing Library, Supertest

---

## 📄 License

This project is proprietary software developed for Sell Square.

---

**Built with ❤️ to help businesses thrive**
