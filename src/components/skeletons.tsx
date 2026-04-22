import React, { FC, HTMLProps, PropsWithChildren } from "react";
import { Box, Text } from "zmp-ui";
import { BodyTextProps } from "zmp-ui/text";

export const TextSkeleton: FC<PropsWithChildren<BodyTextProps>> = ({
  className,
  ...props
}) => {
  return (
    <Text
      {...props}
      className={`text-transparent w-fit h-fit animate-shimmer ${
        className ?? ""
      }`}
      style={{
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        borderRadius: 6,
      }}
    />
  );
};

export const ImageSkeleton: FC<HTMLProps<HTMLImageElement>> = ({
  className,
  ...props
}) => {
  return (
    <div
      {...props}
      className={`animate-shimmer ${className ?? ""}`}
      style={{
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        borderRadius: 12,
        ...(props.style || {}),
      }}
    />
  );
};

export const ProductItemSkeleton: FC = () => {
  return (
    <div className="tm-card" style={{ overflow: 'hidden' }}>
      <ImageSkeleton className="w-full" style={{ aspectRatio: '1', borderRadius: '16px 16px 0 0' }} />
      <div style={{ padding: '10px' }}>
        <TextSkeleton>1234567890</TextSkeleton>
        <TextSkeleton size="xxSmall" style={{ marginTop: 4 }}>20,000đ</TextSkeleton>
      </div>
    </div>
  );
};

export const ProductSlideSkeleton: FC = () => {
  return (
    <div className="tm-card" style={{ overflow: 'hidden' }}>
      <ImageSkeleton className="w-full" style={{ aspectRatio: '16/9', borderRadius: '16px 16px 0 0' }} />
      <Box style={{ padding: '10px 12px' }} className="space-y-2">
        <TextSkeleton size="small">1234567890</TextSkeleton>
        <TextSkeleton size="xxSmall">25,000đ</TextSkeleton>
        <TextSkeleton size="large">20,000đ</TextSkeleton>
      </Box>
    </div>
  );
};

export const ProductSearchResultSkeleton: FC = () => {
  return (
    <div className="tm-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
      <ImageSkeleton style={{ width: 80, height: 80, borderRadius: 12, flexShrink: 0 }} />
      <Box className="space-y-2" style={{ flex: 1 }}>
        <TextSkeleton>1234567890</TextSkeleton>
        <TextSkeleton size="xSmall">25,000đ</TextSkeleton>
      </Box>
    </div>
  );
};
