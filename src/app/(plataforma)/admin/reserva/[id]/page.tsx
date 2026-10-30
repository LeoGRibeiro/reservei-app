"use client";

import { use } from "react";
import { AdminReservaDetalhes } from "@/components/admin/AdminReservaDetalhes";

interface Props {
  params: Promise<{ id: string }>;
}

export default function AdminReservaPage({ params }: Props) {
  const { id } = use(params);
  return <AdminReservaDetalhes reservaId={id} />;
}
