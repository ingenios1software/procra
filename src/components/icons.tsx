import type { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 256 256" 
      width="1em" 
      height="1em"
      {...props}
    >
      <g fill="hsl(var(--primary))">
        <path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88Z"/>
        <path d="M168 88H88a48 48 0 0 0 0 96h80v-16h-80a32 32 0 0 1 0-64h80a16 16 0 0 0 16-16V88Z" opacity=".2"/>
        <path d="M176,80H88a56,56,0,0,0,0,112h80a8,8,0,0,0,8-8V168H88a40,40,0,0,1,0-80h88a8,8,0,0,0,8-8V88A8,8,0,0,0,176,80Zm-88,96a40,40,0,0,1,0-80ZM168,96v16H88a24,24,0,0,0,0,48h80v16Z"/>
      </g>
    </svg>
  );
}
