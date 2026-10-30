"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { avatarUrl, type AgentAvatar as Avatar } from "./agent-model";

const SVG_NS = "http://www.w3.org/2000/svg";
const animatedSvgCache = new Map<string, Promise<string | null>>();

const ANIMATION_STYLES = `
.blink{animation:bl 4s infinite;animation-delay:var(--d,0s);transform-box:fill-box;transform-origin:center}
@keyframes bl{0%,91%,100%{transform:scaleY(1)}94%{transform:scaleY(.08)}}
.look{animation:lk 6s infinite ease-in-out;animation-delay:var(--d,0s)}
@keyframes lk{0%,12%{transform:translate(0,0)}22%,38%{transform:translate(-4px,1px)}48%,62%{transform:translate(4px,-1px)}72%,100%{transform:translate(0,0)}}
.spin{animation:sp 9s linear infinite;animation-delay:var(--d,0s)}
.piv{transform-box:view-box;transform-origin:50px 50px}
.rev{animation-direction:reverse}
.slow{animation-duration:16s}
@keyframes sp{to{transform:rotate(360deg)}}
.pulse{animation:pu 3s ease-in-out infinite;animation-delay:var(--d,0s);transform-box:fill-box;transform-origin:center}
@keyframes pu{50%{transform:scale(1.2)}}
.float{animation:fl 4s ease-in-out infinite;animation-delay:var(--d,0s)}
@keyframes fl{50%{transform:translate(5px,-5px)}}
.talk{animation:tk 5s infinite;animation-delay:var(--d,0s);transform-box:fill-box;transform-origin:center}
@keyframes tk{0%,70%,100%{transform:scaleY(1)}78%{transform:scaleY(.55)}88%{transform:scaleY(1.15)}}
@media(prefers-reduced-motion:reduce){*{animation:none!important}}
`;

function wrapWithAnimation(doc: XMLDocument, element: Element, className: string) {
  const wrapper = doc.createElementNS(SVG_NS, "g");
  wrapper.classList.add(className);
  element.replaceWith(wrapper);
  wrapper.appendChild(element);
  return wrapper;
}

function addSvgAnimations(markup: string, style: Avatar["style"], seed: string) {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.localName !== "svg" || doc.querySelector("parsererror") || svg.querySelector("script")) return null;

  const maskedContent = svg.querySelector("g[mask]");
  if (!maskedContent) return null;

  const delayHash = [...seed].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 0);
  svg.style.setProperty("--d", `${-(delayHash % 30) / 10}s`);

  const artwork = [...maskedContent.children].filter((element) => {
    if (element.localName !== "rect") return true;
    const [x, y, width, height] = (svg.getAttribute("viewBox") ?? "0 0 100 100").split(/\s+/).map(Number);
    return !(Number(element.getAttribute("x") ?? 0) === x && Number(element.getAttribute("y") ?? 0) === y &&
      Number(element.getAttribute("width")) === width && Number(element.getAttribute("height")) === height);
  });

  const floating = doc.createElementNS(SVG_NS, "g");
  floating.classList.add("float");

  artwork.forEach((element, index) => {
    let animation: string | undefined;
    if (style === "bottts-neutral") animation = index === 0 ? "talk" : index === 1 ? "look" : undefined;
    if (style === "thumbs" && index === 0) animation = "pulse";

    const wrapper = animation ? wrapWithAnimation(doc, element, animation) : element;

    if (style === "bottts-neutral" && index === 1 && animation) {
      const blink = doc.createElementNS(SVG_NS, "g");
      blink.classList.add("blink");
      while (wrapper.firstChild) blink.appendChild(wrapper.firstChild);
      wrapper.appendChild(blink);
    }

    if (style === "shapes") {
      const spinning = wrapWithAnimation(doc, wrapper, "spin");
      spinning.classList.add("piv");
      if (index % 2 === 1) spinning.classList.add("rev");
      if (index === artwork.length - 1) spinning.classList.add("slow");
      floating.appendChild(spinning);
    } else {
      floating.appendChild(wrapper);
    }
  });

  maskedContent.appendChild(floating);
  const animationStyle = doc.createElementNS(SVG_NS, "style");
  animationStyle.textContent = ANIMATION_STYLES;
  svg.insertBefore(animationStyle, svg.firstChild);
  return new XMLSerializer().serializeToString(svg);
}

function animatedAvatarDataUrl(markup: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

export function AgentAvatar({ avatar, className }: { avatar: Avatar; className?: string }) {
  const source = avatarUrl(avatar);
  const [animatedSource, setAnimatedSource] = useState(source);

  useEffect(() => {
    let active = true;
    setAnimatedSource(source);

    let response = animatedSvgCache.get(source);
    if (!response) {
      response = fetch(source)
        .then((result) => result.ok ? result.text() : null)
        .catch(() => null);
      animatedSvgCache.set(source, response);
    }

    void response.then((markup) => {
      if (!active || !markup) return;
      const animatedMarkup = addSvgAnimations(markup, avatar.style, avatar.seed);
      if (animatedMarkup) setAnimatedSource(animatedAvatarDataUrl(animatedMarkup));
    });

    return () => {
      active = false;
    };
  }, [avatar.seed, avatar.style, source]);

  return (
    <img
      src={animatedSource}
      alt=""
      loading="lazy"
      className={cn("shrink-0 rounded-full bg-accent object-cover", className)}
    />
  );
}
