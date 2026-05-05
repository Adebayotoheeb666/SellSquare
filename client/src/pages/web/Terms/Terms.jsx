import { Helmet } from "react-helmet";
import SiteNav from "../../../components/header/SiteNav";
import Footer from "../../../components/footer/Footer";
import "./terms.css";

const Terms = () => {
  return (
    <div className="terms_page">
      <Helmet>
        <title>Terms and Conditions | Sell Square - User Agreement</title>
        <meta
          name="description"
          content="Read Sell Square's terms and conditions. Understand the rules, regulations, and user agreement for using our cloud-based business management and inventory software platform."
        />
        <meta
          name="keywords"
          content="sell square terms, terms and conditions, user agreement, software terms, business management terms, legal agreement, usage policy, service terms"
        />
        <meta name="author" content="Sell Square" />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="Terms and Conditions | Sell Square" />
        <meta
          property="og:description"
          content="Read our terms and conditions to understand the rules and regulations governing the use of Sell Square's business management platform."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.sellsquarehub.com/terms-and-agreement" />
        <meta property="og:site_name" content="Sell Square" />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Terms and Conditions | Sell Square" />
        <meta
          name="twitter:description"
          content="Read our terms and conditions for using Sell Square's business management platform."
        />
        <link rel="canonical" href="https://www.sellsquarehub.com/terms-and-agreement" />
      </Helmet>
      <div className="terms-site-nav">
        <SiteNav />
      </div>
      <div className="terms_content">
        <h1>Terms and Conditions</h1>
        <p className="update_date">
          Last Updated: Monday, 5th of August, 2024.
        </p>

        <h2>1. Agreement to Terms</h2>
        <p>
          These Terms and Conditions constitute a legally binding agreement made
          between you, whether personally or on behalf of an entity (“you”) and
          Sell Square (“we,” “us” or “our”), concerning your access to and use
          of the www.sellsquarehub.com web/mobile app as well as any other media
          form, media channel, mobile app, or mobile application related,
          linked, or otherwise connected thereto (collectively, the “Software”).
        </p>
        <p>
          You agree that by accessing the software, you have read, understood,
          and agreed to be bound by all of these Terms and Conditions. If you do
          not agree with all of these Terms and Conditions, then you are
          expressly prohibited from using the software and you must discontinue
          use immediately.
        </p>

        <h2>2. Changes to These Terms</h2>
        <p>
          We reserve the right, in our sole discretion, to make changes or
          modifications to these Terms and Conditions at any time and for any
          reason. We will alert you about any changes by updating the “Last
          Updated” date of these Terms and Conditions, and you waive any right
          to receive specific notice of each such change.
        </p>

        <h2>3. User Responsibilities</h2>
        <p>
          As a user of the software, you agree to use the software in a manner
          consistent with any and all applicable laws and regulations. You must
          not use the software for any unlawful or prohibited purpose, or in any
          way that could damage, disable, overburden, or impair the software.
        </p>

        <h2>4. User Registration</h2>
        <p>
          You may be required to register with the software. You agree to keep
          your password confidential and will be responsible for all use of your
          account and password. We reserve the right to remove, reclaim, or
          change a username you select if we determine, in our sole discretion,
          that such username is inappropriate, obscene, or otherwise
          objectionable.
        </p>

        <h2>5. Fees and Payment</h2>
        <p>
          We may charge fees for access to certain features or services on the
          software. You agree to provide current, complete, and accurate
          purchase and account information for all purchases made via the
          software. You further agree to promptly update account and payment
          information, including email address, payment method, and payment card
          expiration date, so that we can complete your transactions and contact
          you as needed.
        </p>

        <h2>6. Prohibited Activities</h2>
        <p>
          You may not access or use the software for any purpose other than that
          for which we make the software available. The software may not be used
          in connection with any commercial endeavors except those that are
          specifically endorsed or approved by us.
        </p>

        <h2>7. Intellectual Property Rights</h2>
        <p>
          Unless otherwise indicated, the software is our proprietary property
          and all source code, databases, functionality, software, web software
          designs, audio, video, text, photographs, and graphics on the software
          (collectively, the “Content”) and the trademarks, service marks, and
          logos contained therein (the “Marks”) are owned or controlled by us or
          licensed to us.
        </p>

        <h2>8. Termination</h2>
        <p>
          We may terminate or suspend your access to the software at any time,
          without prior notice or liability, for any reason whatsoever,
          including without limitation if you breach the Terms. Upon
          termination, your right to use the software will immediately cease.
        </p>

        <h2>9. Limitation of Liability</h2>
        <p>
          In no event will we be liable to you or any third party for any
          direct, indirect, consequential, exemplary, incidental, special, or
          punitive damages, including lost profit, lost revenue, loss of data,
          or other damages arising from your use of the software, even if we
          have been advised of the possibility of such damages.
        </p>

        <h2>10. Governing Law</h2>
        <p>
          These Terms and your use of the software are governed by and construed
          in accordance with the laws of Nigeria, and any disputes relating to
          these Terms and Conditions will be subject to the exclusive
          jurisdiction of the courts of Nigeria.
        </p>

        <h2>11. Contact Us</h2>
        <p>
          If you have any questions or concerns about these Terms and
          Conditions, please contact us at{" "}
          <a href="mailto:info@sellsquarehub.com">info@sellsquarehub.com</a>.
        </p>
      </div>
      <Footer />
    </div>
  );
};

export default Terms;