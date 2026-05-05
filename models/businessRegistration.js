const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const businessRegistrationSchema = new mongoose.Schema({
  businessName: String,
  businessEmail: {
    type: String,
    required: [true, "Please add an email"],
    unique: true,
    trim: true,
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      "Please enter a valid email",
    ],
  },
  businessAddress: String,
  businessPhone: String,
  industry: String,
  country: String,
  photo: {
    type: String,
    required: [true, "Please add a photo"],
    default: "https://i.ibb.co/4pDNDk1/avatar.png",
  },
  businessOwner: {
    firstName: String,
    lastName: String,
    email: String,
    password: String,
    permissions: {
      addProducts: {
        type: Boolean,
        default: true,
      },
      deleteProducts: {
        type: Boolean,
        default: true,
      },
      editproducts: {
        type: Boolean,
        default: true,
      },
      returnItems: {
        type: Boolean,
        default: true,
      },
      sellProducts: {
        type: Boolean,
        default: true,
      },
      grantPermissions: {
        type: Boolean,
        default: true,
      },
      seeBusinessFinances: {
        type: Boolean,
        default: true,
      },
    },
  },
  salesRep: [
    {
      firstName: String,
      lastName: String,
      email: String,
      password: String,
      permissions: {
        addProducts: {
          type: Boolean,
          default: false,
        },
        deleteProducts: {
          type: Boolean,
          default: false,
        },
        editproducts: {
          type: Boolean,
          default: false,
        },
        returnItems: {
          type: Boolean,
          default: false,
        },
        grantPermissions: {
          type: Boolean,
          default: false,
        },
        seeBusinessFinances: {
          type: Boolean,
          default: false,
        },
        sellProducts: {
          type: Boolean,
          default: true,
        },
      },
      branchAssignments: [
        {
          storeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BusinessRegistration",
          },
          permissions: {
            addProducts: {
              type: Boolean,
              default: false,
            },
            deleteProducts: {
              type: Boolean,
              default: false,
            },
            editProducts: {
              type: Boolean,
              default: false,
            },
            returnItems: {
              type: Boolean,
              default: false,
            },
            grantPermissions: {
              type: Boolean,
              default: false,
            },
            seeBusinessFinances: {
              type: Boolean,
              default: false,
            },
            sellProducts: {
              type: Boolean,
              default: false,
            },
          },
        },
      ],
    },
  ],
  subscription: {
    isSubscribed: {
      type: Boolean,
      default: true,
    },
    subscriptionType: {
      type: String,
      default: "recurring",
    },
    plan: {
      type: String,
      default: "Free",
    },
    businessActivities: {
      type: Boolean,
      default: false,
    },
    nextDueDate: {
      type: Date,
      default: () => Date.now() + 14 * 24 * 60 * 60 * 1000,
    },
  },
  connectedStores: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessRegistration",
    },
  ],
  verified: {
    sendgrid: {
      type: Boolean,
      default: false,
    },
  },
});

// businessRegistrationSchema.pre("save", async function (next) {
//     // if (!this.businessOwner.isModified("password") || !this.salesRep[0].isModified("password")) {
//     //     return next();
//     // }

//     // Hash password
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(this.businessOwner.password, salt);
//     // const hashedPassword2 = await bcrypt.hash(this.salesRep[0]?.password, salt);
//     this.businessOwner.password = hashedPassword;
//     // this.salesRep[0].password = hashedPassword2;
//     next();
// });

businessRegistrationSchema.pre("save", async function (next) {
  // Only hash if the businessOwner.password field was modified
  if (!this.isModified("businessOwner.password")) return next();
  this.businessOwner.password = await bcrypt.hash(
    this.businessOwner.password,
    10
  );
  next();
});

// Create the primary model and a legacy alias used across older refs/populates.
const BusinessRegistration =
  mongoose.models.BusinessRegistration
  || mongoose.model("BusinessRegistration", businessRegistrationSchema);

if (!mongoose.models.Business) {
  mongoose.model(
    "Business",
    businessRegistrationSchema,
    BusinessRegistration.collection.name,
  );
}

module.exports = BusinessRegistration;
