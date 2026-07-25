import styled from "styled-components";
// make sure to import styled-components library

export const LoaderStyle = styled.div`
  .dots-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
  }

  .dot {
    height: 20px;
    width: 20px;
    margin-right: 10px;
    border-radius: 10px;
    background-color: #b3d4fc;
    animation: pulse 1.5s infinite ease-in-out;
  }

  .dot:last-child {
    margin-right: 0;
  }

  .dot:nth-child(1) {
    animation-delay: -0.3s;
  }

  .dot:nth-child(2) {
    animation-delay: -0.1s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.1s;
  }

  @keyframes pulse {
    0% {
      transform: scale(0.8);
      background-color: #b3d4fc;
      box-shadow: 0 0 0 0 rgba(178, 212, 252, 0.7);
    }

    50% {
      transform: scale(1.2);
      background-color: #6793fb;
      box-shadow: 0 0 0 10px rgba(178, 212, 252, 0);
    }

    100% {
      transform: scale(0.8);
      background-color: #b3d4fc;
      box-shadow: 0 0 0 0 rgba(178, 212, 252, 0.7);
    }
  }
`;

export const SecondLoaderStyle = styled.div`
  .loader {
    z-index: 20;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: visible;
  }

  .loader span {
    width: 50px;
    height: 50px;
    margin: -5px;
    animation: dots_411 1.5s infinite ease-in-out;
  }

  .loader span:nth-child(1) {
    -webkit-animation-delay: -0.4s;
    animation-delay: -0.4s;
  }

  .loader span:nth-child(2) {
    -webkit-animation-delay: -0.25s;
    animation-delay: -0.25s;
  }

  .loader span:nth-child(3) {
    -webkit-animation-delay: -0.1s;
    animation-delay: -0.1s;
  }

  @keyframes dots_411 {
    5% {
      opacity: 0;
    }

    0%,
    80%,
    100% {
      -webkit-transform: scale(0);
      transform: scale(0);
    }

    40% {
      -webkit-transform: scale(0.8);
      transform: scale(0.8);
    }
  }
`;

export const SpinnerStyle = styled.div`
  .spinner {
    font-size: 18px;
    position: relative;
    display: inline-block;
    width: 1em;
    height: 1em;
    color: inherit;
  }

  .spinner.center {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    margin: auto;
  }

  .spinner .spinner-blade {
    position: absolute;
    left: 0.4629em;
    bottom: 0;
    width: 0.074em;
    height: 0.2777em;
    border-radius: 0.0555em;
    background-color: transparent;
    transform-origin: center -0.2222em;
    animation: spinner-fade9234 1s infinite linear;
  }

  .spinner .spinner-blade:nth-child(1) { animation-delay: 0s; transform: rotate(0deg); }
  .spinner .spinner-blade:nth-child(2) { animation-delay: 0.083s; transform: rotate(30deg); }
  .spinner .spinner-blade:nth-child(3) { animation-delay: 0.166s; transform: rotate(60deg); }
  .spinner .spinner-blade:nth-child(4) { animation-delay: 0.249s; transform: rotate(90deg); }
  .spinner .spinner-blade:nth-child(5) { animation-delay: 0.332s; transform: rotate(120deg); }
  .spinner .spinner-blade:nth-child(6) { animation-delay: 0.415s; transform: rotate(150deg); }
  .spinner .spinner-blade:nth-child(7) { animation-delay: 0.498s; transform: rotate(180deg); }
  .spinner .spinner-blade:nth-child(8) { animation-delay: 0.581s; transform: rotate(210deg); }
  .spinner .spinner-blade:nth-child(9) { animation-delay: 0.664s; transform: rotate(240deg); }
  .spinner .spinner-blade:nth-child(10) { animation-delay: 0.747s; transform: rotate(270deg); }
  .spinner .spinner-blade:nth-child(11) { animation-delay: 0.83s; transform: rotate(300deg); }
  .spinner .spinner-blade:nth-child(12) { animation-delay: 0.913s; transform: rotate(330deg); }

  @keyframes spinner-fade9234 {
    0% {
      background-color: currentColor; /* adapts automatically */
    }
    100% {
      background-color: transparent;
    }
  }
`;


export const ClockLoaderStyle = styled.div`
  .loader {
    position: relative;
    transform: scale(2);
    border-radius: 50%;
    border: 0.5px solid;
    width: 20px;
    height: 20px;
    color: #1835B3;
  }

  .loader::after {
    position: absolute;
    width: 0px;
    height: 8px;
    display: block;
    border-left: 1px solid #1835B3;
    content: '';
    left: 9px;
    border-radius: 1px;
    top: 1px;
    animation-duration: 1s;
  }

  .loader::before {
    position: absolute;
    width: 0px;
    height: 8px;
    display: block;
    border-left: 1px solid #1835B3;
    content: '';
    left: 9px;
    border-radius: 1px;
    top: 1px;
    animation-duration: 40s;
  }

  .loader::before,.loader::after {
    transform-origin: bottom;
    animation-name: dial;
    animation-iteration-count: infinite;
    animation-timing-function: linear;
  }

  @keyframes dial {
    0% {
      transform: rotate(0deg);
    }

    100% {
      transform: rotate(360deg);
    }
  }`;