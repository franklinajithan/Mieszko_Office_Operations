import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "pdfkit"],
  outputFileTracingIncludes: {
    "/shop/order/[supplierId]/review": ["./src/server/pdf/fonts/**/*"],
    "/shop/orders/[orderId]": ["./src/server/pdf/fonts/**/*"],
    "/office/orders/[orderId]": ["./src/server/pdf/fonts/**/*"],
  },
};

export default nextConfig;
