import {
  orderEmailHtml,
  orderPdfFilename,
  orderedLines,
  shopEmailSubject,
  supplierEmailSubject,
  supplierRecipients,
  type EmailOrder,
} from "./order-message";

export type DispatchTarget = "both" | "supplier" | "shop";

export type MailAttachment = {
  filename: string;
  content: Uint8Array;
};

export type OutboundEmail = {
  to: string;
  cc: string[];
  subject: string;
  html: string;
  attachments: MailAttachment[];
};

export type SendResult = {
  id?: string | null;
  error?: string | null;
};

export type ChannelResult = {
  attempted: boolean;
  status: "sent" | "failed" | "missing" | "skipped";
  recipient: string | null;
  cc: string[];
  subject: string;
  error?: string;
  providerId: string | null;
  attachmentNames: string[];
};

export type DispatchResult = {
  supplier: ChannelResult;
  shop: ChannelResult;
  keepSubmittedOrder: true;
  updateSupplierStatus: boolean;
  updateShopStatus: boolean;
};

const NOT_CONFIGURED = "Email is not configured.";
const SUPPLIER_MISSING = "Supplier order email is not configured.";
const SHOP_MISSING = "Shop email not configured";
const PDF_FAILED = "Unable to create the order PDF.";

function skipped(subject = ""): ChannelResult {
  return {
    attempted: false,
    status: "skipped",
    recipient: null,
    cc: [],
    subject,
    providerId: null,
    attachmentNames: [],
  };
}

function recorded(input: Omit<ChannelResult, "attempted">): ChannelResult {
  return { attempted: true, ...input };
}

export async function dispatchOrderEmails(input: {
  order: EmailOrder;
  from: string | null;
  target: DispatchTarget;
  send: (message: OutboundEmail) => Promise<SendResult>;
  renderPdf: (order: EmailOrder) => Promise<MailAttachment>;
}): Promise<DispatchResult> {
  const order: EmailOrder = { ...input.order, lines: orderedLines(input.order.lines) };
  const supplierSubject = supplierEmailSubject(order);
  const shopSubject = shopEmailSubject(order);
  const recipients = supplierRecipients(order);
  let supplier = skipped(supplierSubject);
  let shop = skipped(shopSubject);

  if (input.target === "both" || input.target === "supplier") {
    supplier = await sendSupplier(input, order, recipients, supplierSubject);
  }

  const shopAllowed = input.target === "shop" || (input.target === "both" && supplier.status === "sent");
  if (shopAllowed) {
    shop = await sendShop(input, order, shopSubject);
  }

  return {
    supplier,
    shop,
    keepSubmittedOrder: true,
    updateSupplierStatus: supplier.attempted,
    updateShopStatus: shop.attempted,
  };
}

async function sendSupplier(
  input: { from: string | null; send: (message: OutboundEmail) => Promise<SendResult> },
  order: EmailOrder,
  recipients: { to: string | null; cc: string[] },
  subject: string,
): Promise<ChannelResult> {
  if (!recipients.to) {
    return recorded({ status: "failed", recipient: null, cc: recipients.cc, subject, error: SUPPLIER_MISSING, providerId: null, attachmentNames: [] });
  }
  if (!input.from) {
    return recorded({ status: "failed", recipient: recipients.to, cc: recipients.cc, subject, error: NOT_CONFIGURED, providerId: null, attachmentNames: [] });
  }
  const message: OutboundEmail = {
    to: recipients.to,
    cc: recipients.cc,
    subject,
    html: orderEmailHtml(order, false),
    attachments: [],
  };
  return deliver(input.send, message, subject);
}

async function sendShop(
  input: { from: string | null; send: (message: OutboundEmail) => Promise<SendResult>; renderPdf: (order: EmailOrder) => Promise<MailAttachment> },
  order: EmailOrder,
  subject: string,
): Promise<ChannelResult> {
  const recipient = order.storeEmail?.trim() || null;
  if (!recipient) {
    return recorded({ status: "missing", recipient: null, cc: [], subject, error: SHOP_MISSING, providerId: null, attachmentNames: [] });
  }
  if (!input.from) {
    return recorded({ status: "failed", recipient, cc: [], subject, error: NOT_CONFIGURED, providerId: null, attachmentNames: [] });
  }
  let pdf: MailAttachment;
  try {
    pdf = await input.renderPdf(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : PDF_FAILED;
    return recorded({ status: "failed", recipient, cc: [], subject, error: message || PDF_FAILED, providerId: null, attachmentNames: [] });
  }
  const message: OutboundEmail = {
    to: recipient,
    cc: [],
    subject,
    html: orderEmailHtml(order, true),
    attachments: [pdf.filename ? pdf : { ...pdf, filename: orderPdfFilename(order) }],
  };
  return deliver(input.send, message, subject);
}

async function deliver(send: (message: OutboundEmail) => Promise<SendResult>, message: OutboundEmail, subject: string): Promise<ChannelResult> {
  try {
    const sent = await send(message);
    if (sent.error) {
      return recorded({
        status: "failed",
        recipient: message.to,
        cc: message.cc,
        subject,
        error: sent.error,
        providerId: null,
        attachmentNames: message.attachments.map((file) => file.filename),
      });
    }
    return recorded({
      status: "sent",
      recipient: message.to,
      cc: message.cc,
      subject,
      providerId: sent.id ?? null,
      attachmentNames: message.attachments.map((file) => file.filename),
    });
  } catch (error) {
    return recorded({
      status: "failed",
      recipient: message.to,
      cc: message.cc,
      subject,
      error: error instanceof Error ? error.message : "Unable to send email.",
      providerId: null,
      attachmentNames: message.attachments.map((file) => file.filename),
    });
  }
}
