import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export type BrandBackgroundVariant = 'tag' | 'beams' | 'focus' | 'soft' | 'light';

export function BrandBackground({ variant = 'soft' }: { variant?: BrandBackgroundVariant }) {
  const light = variant === 'light';
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="darkBase" x1="28" y1="0" x2="360" y2="844" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#003426" />
            <Stop offset="0.42" stopColor="#001E17" />
            <Stop offset="1" stopColor="#000A08" />
          </LinearGradient>
          <LinearGradient id="lightBase" x1="0" y1="0" x2="390" y2="844" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FCFCF8" />
            <Stop offset="0.52" stopColor="#F4F5EF" />
            <Stop offset="1" stopColor="#E9ECE6" />
          </LinearGradient>
          <RadialGradient id="limeGlow" cx="0" cy="1" rx="1" ry="1">
            <Stop offset="0" stopColor="#C8FF2E" stopOpacity=".72" />
            <Stop offset=".3" stopColor="#51DB4D" stopOpacity=".28" />
            <Stop offset="1" stopColor="#00834F" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="centerGlow" cx=".5" cy=".48" rx=".5" ry=".5">
            <Stop offset="0" stopColor="#41E45C" stopOpacity=".34" />
            <Stop offset=".38" stopColor="#079A50" stopOpacity=".18" />
            <Stop offset="1" stopColor="#003B2B" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="lightGlow" cx="0" cy="1" rx="1" ry="1">
            <Stop offset="0" stopColor="#B9FF32" stopOpacity=".48" />
            <Stop offset=".34" stopColor="#DFF5A7" stopOpacity=".24" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="tagFill" x1="205" y1="50" x2="390" y2="720" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#8BEB36" stopOpacity=".34" />
            <Stop offset=".28" stopColor="#0E9E51" stopOpacity=".22" />
            <Stop offset="1" stopColor="#003526" stopOpacity=".04" />
          </LinearGradient>
          <LinearGradient id="peelFill" x1="130" y1="610" x2="390" y2="844" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#0B5B41" stopOpacity=".08" />
            <Stop offset=".5" stopColor="#0A7C4A" stopOpacity=".16" />
            <Stop offset="1" stopColor="#001A14" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="beam" x1="0" y1="844" x2="220" y2="0" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#D2FF28" stopOpacity=".48" />
            <Stop offset=".32" stopColor="#34D74D" stopOpacity=".21" />
            <Stop offset="1" stopColor="#00884F" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="fadeDown" x1="0" y1="0" x2="0" y2="844" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#000000" stopOpacity=".05" />
            <Stop offset=".55" stopColor="#000000" stopOpacity=".08" />
            <Stop offset="1" stopColor="#000000" stopOpacity=".42" />
          </LinearGradient>
          <RadialGradient id="vignette" cx=".5" cy=".45" rx=".75" ry=".62">
            <Stop offset=".42" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity=".44" />
          </RadialGradient>
        </Defs>

        <Rect width="390" height="844" fill={light ? 'url(#lightBase)' : 'url(#darkBase)'} />
        {light ? <LightArtwork /> : null}
        {variant === 'tag' ? <TagArtwork /> : null}
        {variant === 'beams' ? <BeamArtwork /> : null}
        {variant === 'focus' ? <FocusArtwork /> : null}
        {variant === 'soft' ? <SoftArtwork /> : null}
        {!light ? <><Rect width="390" height="844" fill="url(#fadeDown)" /><Rect width="390" height="844" fill="url(#vignette)" /></> : null}
      </Svg>
    </View>
  );
}

function TagArtwork() {
  return <>
    <Circle cx="10" cy="795" r="310" fill="url(#limeGlow)" opacity=".26" />
    <Path d="M218 154 C222 133 233 113 249 97 L306 38 C320 23 340 17 360 18 L432 21 L432 512 C380 539 347 568 322 615 C285 686 245 722 178 758 C193 597 203 414 218 154 Z" fill="url(#tagFill)" stroke="#9BFF52" strokeOpacity=".16" strokeWidth="1.3" />
    <Circle cx="342" cy="98" r="28" fill="#001B14" fillOpacity=".72" stroke="#B7FF5A" strokeOpacity=".28" />
    <Path d="M178 758 C250 718 284 681 322 615 C350 566 386 537 432 512 L432 844 H78 C124 818 154 786 178 758 Z" fill="url(#peelFill)" stroke="#79D84B" strokeOpacity=".08" />
  </>;
}

function BeamArtwork() {
  return <>
    <Circle cx="-20" cy="820" r="355" fill="url(#limeGlow)" opacity=".7" />
    <Path d="M-58 874 L113 -50" stroke="url(#beam)" strokeWidth="55" strokeLinecap="round" opacity=".54" />
    <Path d="M18 884 L177 -40" stroke="url(#beam)" strokeWidth="24" strokeLinecap="round" opacity=".32" />
    <Path d="M103 884 L254 -25" stroke="url(#beam)" strokeWidth="11" strokeLinecap="round" opacity=".17" />
    <Path d="M-10 845 C92 654 130 421 176 0" fill="none" stroke="#BFFF34" strokeOpacity=".11" strokeWidth="2" />
  </>;
}

function FocusArtwork() {
  return <>
    <Ellipse cx="196" cy="425" rx="235" ry="365" fill="url(#centerGlow)" />
    <Path d="M152 742 C171 604 168 456 173 296" fill="none" stroke="#7EFF59" strokeOpacity=".07" strokeWidth="1.2" />
    <Path d="M204 733 C217 586 213 423 218 255" fill="none" stroke="#B6FF53" strokeOpacity=".08" strokeWidth="1" />
    <Path d="M256 708 C264 566 255 418 262 306" fill="none" stroke="#4DDB54" strokeOpacity=".06" strokeWidth="1.4" />
  </>;
}

function SoftArtwork() {
  return <>
    <Circle cx="-28" cy="800" r="370" fill="url(#limeGlow)" opacity=".48" />
    <Ellipse cx="210" cy="208" rx="250" ry="270" fill="url(#centerGlow)" opacity=".54" />
    <Path d="M-72 722 C72 603 174 629 292 507 C340 457 382 438 445 430" fill="none" stroke="#62D851" strokeOpacity=".07" strokeWidth="92" strokeLinecap="round" />
    <Path d="M-55 735 C77 619 181 650 302 518 C349 467 391 450 438 444" fill="none" stroke="#B1FF56" strokeOpacity=".08" strokeWidth="1.2" />
  </>;
}

function LightArtwork() {
  return <>
    <Circle cx="-20" cy="835" r="365" fill="url(#lightGlow)" />
    <Path d="M223 152 C227 131 238 113 253 98 L308 42 C322 28 340 23 361 24 L431 27 L431 516 C380 542 348 570 324 616 C288 682 248 719 184 752 C198 592 208 409 223 152 Z" fill="#C7D0BC" fillOpacity=".07" stroke="#98B57E" strokeOpacity=".08" />
    <Circle cx="343" cy="104" r="27" fill="#F1F2EC" fillOpacity=".5" stroke="#FFFFFF" strokeOpacity=".7" />
    <Path d="M184 752 C252 716 288 680 324 616 C351 568 386 541 431 516 L431 844 H86 C129 819 161 783 184 752 Z" fill="#DDE4D6" fillOpacity=".08" />
  </>;
}
