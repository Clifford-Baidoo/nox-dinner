export interface Seat {
  id: string;
  label: string;
  taken: boolean;
  isMine?: boolean;
  guestName?: string;
  bookingCode?: string;
}

export type TableShape = "round" | "square" | "rectangle";

export interface TableWithSeats {
  id: string;
  name: string;
  sortOrder?: number;
  shape: TableShape;
  x: number | null;
  y: number | null;
  seats: Seat[];
}

export interface BookingInfo {
  code: string;
  guestName: string;
  seatsAllowed: number;
  status: "pending" | "confirmed" | "revoked";
}

export interface BookingDetail {
  booking: BookingInfo;
  tables: TableWithSeats[];
}
