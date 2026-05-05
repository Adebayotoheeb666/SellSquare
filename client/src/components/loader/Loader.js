import React from "react";
import ReactDOM from "react-dom";
import "./Loader.scss";

const Loader = () => {
  return ReactDOM.createPortal(
    <div className="wrapper">
      <div className="loader">
        <div className="loader-children">
          <div className="loader-dots">
            <div className="loader-dot"></div>
            <div className="loader-dot"></div>
            <div className="loader-dot"></div>
          </div>
          <p>Please wait...</p>
        </div>
      </div>
    </div>,
    document.getElementById("loader")
  );
};

export const SpinnerImg = () => {
  return ReactDOM.createPortal(
    <div className="wrapper">
      <div className="loader">
        <div className="loader-children">
          <div className="loader-dots">
            <div className="loader-dot"></div>
            <div className="loader-dot"></div>
            <div className="loader-dot"></div>
          </div>
          <p>Please wait...</p>
        </div>
      </div>
    </div>,
    document.getElementById("loader")
  );
};

export default Loader;

// return (
//   <div className="--center-all">
//     <div className="loader-children spinner">
//       <div className="loader-dots">
//         <div className="loader-dot"></div>
//         <div className="loader-dot"></div>
//         <div className="loader-dot"></div>
//       </div>
//       <p>Please wait...</p>
//     </div>
//   </div>
// );
