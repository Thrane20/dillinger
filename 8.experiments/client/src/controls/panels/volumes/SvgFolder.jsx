import React from "react";
import "../../../App.css";

const SvgFolder = ({ className }) => {

    return (
        <div className={className}>
            <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" fillRule="evenodd" clipRule="evenodd">
                <path d="M11 5h13v17h-24v-20h8l3 3zm-10-2v18h22v-15h-12.414l-3-3h-6.586z" fill="currentColor"/>
            </svg>
        </div>
    );
};

export default SvgFolder;