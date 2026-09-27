declare module "nodemailer" {
  export interface Transporter {
    sendMail(options: Record<string, unknown>): Promise<unknown>;
  }

  const nodemailer: {
    createTransport(options: Record<string, unknown>): Transporter;
  };

  export default nodemailer;
}
