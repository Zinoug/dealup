import Image from "next/image";

type DeviceMockupProps = {
  alt: string;
  className?: string;
  priority?: boolean;
  screenshot?: string;
};

export function DeviceMockup({
  alt,
  className = "",
  priority = false,
  screenshot = "/screens/official/home.webp",
}: DeviceMockupProps) {
  return (
    <figure className={`device-mockup ${className}`.trim()}>
      <div className="device-mockup__screen">
        <Image
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 700px) 82vw, 450px"
          src={screenshot}
        />
      </div>
      <Image
        alt=""
        className="device-mockup__frame"
        fill
        priority={priority}
        sizes="(max-width: 700px) 82vw, 450px"
        src="/device/iphone-16-pro-black.png"
      />
    </figure>
  );
}
