"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/admin/auth-provider";
import { useAsync } from "@/features/admin/use-async";
import { isSuper } from "@/features/admin/permissions";
import {
  auditActionLabels,
  auditEntityLabels,
  date,
} from "@/features/admin/format";
import { auditLogsApi, usersApi } from "@/lib/api";
import { AUDIT_ENTITIES, PAGE_SIZE } from "@/lib/constants";
import type { AuditEntity } from "@/lib/api/types";
import { ErrorState, LoadingState, Pager } from "@/components/data-states";
import { EmptyState, PageHeading } from "@/components/ui";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const SHORT_ID_LENGTH = 8;

export default function AuditLogsPage() {
  const { user } = useAuth();
  if (!isSuper(user.role)) {
    return (
      <EmptyState
        title="ไม่มีสิทธิ์เข้าถึง"
        description="หน้านี้ดูได้เฉพาะผู้ดูแลระบบ"
      />
    );
  }
  return <AuditLogs />;
}

function AuditLogs() {
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState<AuditEntity | "">("");
  const [targetId, setTargetId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const users = useAsync((signal) => usersApi.listUsers(signal), []);
  const trimmedTarget = targetId.trim();
  const invalidTarget = Boolean(trimmedTarget && !OBJECT_ID.test(trimmedTarget));
  const invalidRange = Boolean(from && to && from > to);
  const blocked = invalidTarget || invalidRange;
  const entityId = invalidTarget ? "" : trimmedTarget;
  const { data, error, loading, reload } = useAsync(
    (signal) =>
      blocked
        ? Promise.resolve(null)
        : auditLogsApi.listAuditLogs(
            { userId, action, entity, entityId, from, to, page, pageSize: PAGE_SIZE },
            signal,
          ),
    [userId, action, entity, entityId, from, to, page, blocked],
  );
  const rows = data?.data ?? [];

  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  return (
    <>
      <PageHeading
        title="ประวัติการใช้งาน"
        description="ดูว่าใครทำอะไรในระบบ และทำเมื่อไร ดูได้เฉพาะผู้ดูแลระบบ"
        scope="global"
      />
      <div className="panel">
        <div className="filter-bar in-panel">
          <label>
            <span className="sr-only">ทำโดย</span>
            <select
              value={userId}
              onChange={(e) => changeFilter(() => setUserId(e.target.value))}
            >
              <option value="">ทุกคน</option>
              {(users.data ?? []).map((u) => (
                <option value={u.id} key={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">สิ่งที่ทำ</span>
            <select
              value={action}
              onChange={(e) => changeFilter(() => setAction(e.target.value))}
            >
              <option value="">ทุกอย่างที่ทำ</option>
              {Object.entries(auditActionLabels).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">เกี่ยวกับ</span>
            <select
              value={entity}
              onChange={(e) =>
                changeFilter(() => setEntity(e.target.value as AuditEntity | ""))
              }
            >
              <option value="">ทุกเรื่อง</option>
              {AUDIT_ENTITIES.map((key) => (
                <option value={key} key={key}>
                  {auditEntityLabels[key]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">รหัสอ้างอิงของออเดอร์หรืองานวิ่ง</span>
            <input
              type="search"
              value={targetId}
              placeholder="รหัสอ้างอิงของออเดอร์หรืองาน (24 ตัว)"
              aria-invalid={invalidTarget}
              onChange={(e) => changeFilter(() => setTargetId(e.target.value))}
            />
          </label>
          <label>
            <span className="sr-only">ตั้งแต่วันที่</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => changeFilter(() => setFrom(e.target.value))}
            />
          </label>
          <label>
            <span className="sr-only">ถึงวันที่</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => changeFilter(() => setTo(e.target.value))}
            />
          </label>
          <span className="result-count">
            {data ? `${data.meta.total} รายการ` : ""}
          </span>
        </div>
        {invalidRange && (
          <p role="alert" className="form-error">
            วันที่เริ่มต้องไม่เลยวันที่สิ้นสุด กรุณาเลือกใหม่
          </p>
        )}
        {invalidTarget && (
          <p role="alert" className="form-error">
            รหัสไม่ถูกต้อง ต้องมี 24 ตัว ใช้ได้เฉพาะ 0-9 และ a-f
          </p>
        )}
        {error && <ErrorState message={error} onRetry={reload} />}
        {!data && loading && !blocked && <LoadingState />}
        {data &&
          (rows.length ? (
            <>
              <div className="table-scroll" tabIndex={0} role="region" aria-label="ตารางข้อมูล เลื่อนแนวนอนเพื่อดูคอลัมน์เพิ่มเติม" aria-busy={loading}>
                <table className="table-mobile-cards" role="table">
                  <thead>
                    <tr>
                      <th>เวลา</th>
                      <th>ทำโดย</th>
                      <th>สิ่งที่ทำ</th>
                      <th className="table-secondary">เกี่ยวกับ</th>
                      <th className="table-secondary">ข้อมูลเพิ่มเติม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="muted">{date(row.createdAt, true)}</td>
                        <td>
                          {row.actor ? (
                            <>
                              <span className="person-name">{row.actor.name}</span>
                              <small className="cell-sub">{row.actor.email}</small>
                            </>
                          ) : (
                            <span className="muted">ระบบอัตโนมัติ</span>
                          )}
                        </td>
                        <td className="strong">
                          {auditActionLabels[row.action] ?? row.action}
                        </td>
                        <td className="table-secondary">
                          {row.entity === "Order" && row.entityId ? (
                            <Link href={`/orders?order=${row.entityId}`}>
                              ออเดอร์ {row.entityId.slice(-SHORT_ID_LENGTH)}
                            </Link>
                          ) : (
                            <>
                              {auditEntityLabels[row.entity as AuditEntity] ?? row.entity}
                              {row.entityId && (
                                <small className="cell-sub">
                                  {row.entityId.slice(-SHORT_ID_LENGTH)}
                                </small>
                              )}
                            </>
                          )}
                        </td>
                        <td className="table-secondary">
                          {row.meta ? (
                            <details>
                              <summary>ดูข้อมูลเพิ่มเติม</summary>
                              <pre>{JSON.stringify(row.meta, null, 2)}</pre>
                            </details>
                          ) : (
                            <span className="muted">–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager meta={data.meta} unit="รายการ" onPage={setPage} />
            </>
          ) : (
            <EmptyState title="ไม่พบประวัติการใช้งาน" />
          ))}
      </div>
    </>
  );
}
