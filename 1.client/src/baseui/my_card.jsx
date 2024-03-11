import React from "react";

export function MyCard(props) {
    return (
        <div className="card bg-base-100 w-full items-center justify-start">
            <div className="card-body">
                {props.children}
            </div>
        </div>
    );
}
