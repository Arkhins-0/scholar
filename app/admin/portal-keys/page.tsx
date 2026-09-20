import { KeyRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import PortalKeyGenerator from "@/components/PortalKeyGenerator";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function PortalKeysPage() {
  const keys = await prisma.portalKey.findMany({
    include: { usedByStudent: { include: { user: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const available = keys.filter((k) => !k.isUsed && (!k.expiresAt || k.expiresAt > new Date())).length;

  return (
    <div>
      <PageHeader
        icon={KeyRound}
        title="Portal keys"
        subtitle="One-time keys for newly admitted scholars. Only a hash is stored; the full key is shown once at generation."
      />

      <div className="space-y-6">
        <PortalKeyGenerator />

        <div className="box">
          <div className="box-header">
            <h2 className="box-title">Issued keys</h2>
            <span className="chip">{available} available · {keys.length} shown</span>
          </div>
          {keys.length === 0 ? (
            <EmptyState icon={KeyRound} title="No keys generated yet" description="Generate a key above and hand it to the scholar." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="th">Key</th>
                    <th className="th">Status</th>
                    <th className="th">Used by</th>
                    <th className="th">Created</th>
                    <th className="th">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {keys.map((k) => {
                    const expired = !k.isUsed && k.expiresAt !== null && k.expiresAt < new Date();
                    const cls = k.isUsed ? "chip" : expired ? "chip border-danger/40 text-danger" : "chip border-success/40 text-success";
                    return (
                      <tr key={k.id}>
                        <td className="td mono">{k.keyPrefix}-····-····</td>
                        <td className="td">
                          <span className={cls}>{k.isUsed ? "Used" : expired ? "Expired" : "Available"}</span>
                        </td>
                        <td className="td">{k.usedByStudent?.user.name ?? <span className="text-faint">—</span>}</td>
                        <td className="td text-muted">{fmtDate(k.createdAt)}</td>
                        <td className="td text-muted">{k.expiresAt ? fmtDate(k.expiresAt) : "Never"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
