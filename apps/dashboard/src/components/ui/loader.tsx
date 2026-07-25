// make sure to import styled-components library
import { ClockLoaderStyle, SecondLoaderStyle, SpinnerStyle } from "./styles";

export const ClockLoader = () => {
  return (
    <ClockLoaderStyle>
      <div className="loader" />
    </ClockLoaderStyle>
  );
};

export const SecondLoader = () => {
  return (
    <SecondLoaderStyle>
      <div className="loader">
        <span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
            <path
              fill="#FFFFFF"
              d="M158 77c6 23-8 48-28 63-21 16-49 21-68 8-19-12-28-43-20-68s33-45 58-45c26 0 52 20 58 42z"
            />
          </svg>
        </span>
        <span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
            <path
              fill="#FFFFFF"
              d="M158 77c6 23-8 48-28 63-21 16-49 21-68 8-19-12-28-43-20-68s33-45 58-45c26 0 52 20 58 42z"
            />
          </svg>
        </span>
        <span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
            <path
              fill="#FFFFFF"
              d="M158 77c6 23-8 48-28 63-21 16-49 21-68 8-19-12-28-43-20-68s33-45 58-45c26 0 52 20 58 42z"
            />
          </svg>
        </span>
      </div>
    </SecondLoaderStyle>
  );
};

export const Spinner = () => {
  return (
    <SpinnerStyle>
      <div className="spinner center">
        <div className="spinner-blade" />
        <div className="spinner-blade" />
        <div className="spinner-blade" />
        <div className="spinner-blade" />
        <div className="spinner-blade" />
        <div className="spinner-blade" />
        <div className="spinner-blade" />
        <div className="spinner-blade" />
        <div className="spinner-blade" />
        <div className="spinner-blade" />
        <div className="spinner-blade" />
        <div className="spinner-blade" />
      </div>
    </SpinnerStyle>
  );
};

export const LineLoader = () => {
  return <div className="loader"></div>;
};
