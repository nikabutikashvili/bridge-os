import {
  globalSearchResponseSchema,
  type GlobalSearchResponse
} from "@bridge-os/contracts";
import {
  bridges,
  findings,
  recommendations,
  type BridgeDatabase
} from "@bridge-os/db";
import { sql, type SQL } from "drizzle-orm";

import type { GlobalSearchReader } from "./search-reader.js";

interface CountedRow extends Record<string, unknown> {
  readonly totalItems: number | string;
}

interface BridgeSearchRow extends CountedRow {
  readonly id: string;
  readonly externalStructureNumber: string | null;
  readonly name: string | null;
  readonly road: string | null;
  readonly district: string | null;
  readonly locality: string | null;
  readonly municipality: string | null;
}

interface FindingSearchRow extends CountedRow {
  readonly id: string;
  readonly sourceIdentifier: string | null;
  readonly defectType: string | null;
  readonly description: string | null;
  readonly location: string | null;
  readonly status: "OPEN" | "MONITORING" | "RESOLVED" | "DISMISSED" | null;
  readonly bridgeId: string;
  readonly bridgeExternalStructureNumber: string | null;
  readonly bridgeName: string | null;
  readonly bridgeRoad: string | null;
}

interface RecommendationSearchRow extends CountedRow {
  readonly id: string;
  readonly workType: string | null;
  readonly description: string | null;
  readonly urgency: string | null;
  readonly status:
    | "OPEN"
    | "APPROVED"
    | "SCHEDULED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED"
    | null;
  readonly bridgeId: string;
  readonly bridgeExternalStructureNumber: string | null;
  readonly bridgeName: string | null;
  readonly bridgeRoad: string | null;
}

export class PostgresGlobalSearchReader implements GlobalSearchReader {
  public constructor(private readonly database: BridgeDatabase) {}

  public async search({
    limit,
    q
  }: {
    readonly limit: number;
    readonly q: string;
  }): Promise<GlobalSearchResponse> {
    const escapedQuery = escapeIlikeLiteral(q);
    const containsPattern = `%${escapedQuery}%`;
    const prefixPattern = `${escapedQuery}%`;
    const [bridgeResult, findingResult, recommendationResult] =
      await Promise.all([
        this.database.execute<BridgeSearchRow>(sql`
          select
            ${bridges.id} as "id",
            ${bridges.externalStructureNumber} as "externalStructureNumber",
            ${bridges.name} as "name",
            ${bridges.road} as "road",
            ${bridges.district} as "district",
            ${bridges.locality} as "locality",
            ${bridges.municipality} as "municipality",
            count(*) over () as "totalItems",
            case
              when lower(${bridges.externalStructureNumber}) = lower(${q}) then 0
              when ${bridges.externalStructureNumber} ilike ${prefixPattern} escape E'\\\\' then 1
              when ${bridges.name} ilike ${prefixPattern} escape E'\\\\' then 2
              when ${bridges.road} ilike ${prefixPattern} escape E'\\\\' then 3
              else 4
            end as "matchRank"
          from ${bridges}
          where (${bridgeSearchExpression()}) ilike ${containsPattern} escape E'\\\\'
          order by "matchRank", lower(coalesce(${bridges.name}, '')), ${bridges.id}
          limit ${limit}
        `),
        this.database.execute<FindingSearchRow>(sql`
          select
            ${findings.id} as "id",
            ${findings.sourceIdentifier} as "sourceIdentifier",
            ${findings.defectType} as "defectType",
            ${findings.description} as "description",
            ${findings.location} as "location",
            ${findings.status} as "status",
            ${bridges.id} as "bridgeId",
            ${bridges.externalStructureNumber} as "bridgeExternalStructureNumber",
            ${bridges.name} as "bridgeName",
            ${bridges.road} as "bridgeRoad",
            count(*) over () as "totalItems",
            case
              when lower(${findings.sourceIdentifier}) = lower(${q}) then 0
              when ${findings.sourceIdentifier} ilike ${prefixPattern} escape E'\\\\' then 1
              when ${findings.defectType} ilike ${prefixPattern} escape E'\\\\' then 2
              else 3
            end as "matchRank"
          from ${findings}
          join ${bridges} on ${bridges.id} = ${findings.bridgeId}
          where (${findingSearchExpression()}) ilike ${containsPattern} escape E'\\\\'
          order by "matchRank", lower(coalesce(${findings.sourceIdentifier}, '')), ${findings.id}
          limit ${limit}
        `),
        this.database.execute<RecommendationSearchRow>(sql`
          select
            ${recommendations.id} as "id",
            ${recommendations.workType} as "workType",
            ${recommendations.description} as "description",
            ${recommendations.urgency} as "urgency",
            ${recommendations.status} as "status",
            ${bridges.id} as "bridgeId",
            ${bridges.externalStructureNumber} as "bridgeExternalStructureNumber",
            ${bridges.name} as "bridgeName",
            ${bridges.road} as "bridgeRoad",
            count(*) over () as "totalItems",
            case
              when lower(${recommendations.workType}) = lower(${q}) then 0
              when ${recommendations.workType} ilike ${prefixPattern} escape E'\\\\' then 1
              else 2
            end as "matchRank"
          from ${recommendations}
          join ${bridges} on ${bridges.id} = ${recommendations.bridgeId}
          where (${recommendationSearchExpression()}) ilike ${containsPattern} escape E'\\\\'
          order by "matchRank", lower(coalesce(${recommendations.workType}, '')), ${recommendations.id}
          limit ${limit}
        `)
      ]);

    return globalSearchResponseSchema.parse({
      query: q,
      groups: {
        bridges: {
          items: bridgeResult.rows.map((row) => ({
            id: row.id,
            externalStructureNumber: row.externalStructureNumber,
            name: row.name,
            road: row.road,
            location: {
              district: row.district,
              locality: row.locality,
              municipality: row.municipality
            }
          })),
          totalItems: totalItems(bridgeResult.rows)
        },
        findings: {
          items: findingResult.rows.map((row) => ({
            id: row.id,
            sourceIdentifier: row.sourceIdentifier,
            defectType: row.defectType,
            description: row.description,
            location: row.location,
            status: row.status,
            bridge: bridgeContext(row)
          })),
          totalItems: totalItems(findingResult.rows)
        },
        recommendations: {
          items: recommendationResult.rows.map((row) => ({
            id: row.id,
            workType: row.workType,
            description: row.description,
            urgency: row.urgency,
            status: row.status,
            bridge: bridgeContext(row)
          })),
          totalItems: totalItems(recommendationResult.rows)
        }
      }
    });
  }
}

export function escapeIlikeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function bridgeSearchExpression(): SQL {
  return sql`
    coalesce(${bridges.externalStructureNumber}, '') || ' ' ||
    coalesce(${bridges.name}, '') || ' ' ||
    coalesce(${bridges.road}, '') || ' ' ||
    coalesce(${bridges.federalState}, '') || ' ' ||
    coalesce(${bridges.district}, '') || ' ' ||
    coalesce(${bridges.municipality}, '') || ' ' ||
    coalesce(${bridges.locality}, '') || ' ' ||
    coalesce(${bridges.stationing}, '') || ' ' ||
    coalesce(${bridges.crossedFeature}, '')
  `;
}

function findingSearchExpression(): SQL {
  return sql`
    coalesce(${findings.sourceIdentifier}, '') || ' ' ||
    coalesce(${findings.defectType}, '') || ' ' ||
    coalesce(${findings.description}, '') || ' ' ||
    coalesce(${findings.location}, '') || ' ' ||
    coalesce(${findings.extent}, '')
  `;
}

function recommendationSearchExpression(): SQL {
  return sql`
    coalesce(${recommendations.workType}, '') || ' ' ||
    coalesce(${recommendations.description}, '') || ' ' ||
    coalesce(${recommendations.urgency}, '')
  `;
}

function bridgeContext(
  row: FindingSearchRow | RecommendationSearchRow
): {
  readonly id: string;
  readonly externalStructureNumber: string | null;
  readonly name: string | null;
  readonly road: string | null;
} {
  return {
    id: row.bridgeId,
    externalStructureNumber: row.bridgeExternalStructureNumber,
    name: row.bridgeName,
    road: row.bridgeRoad
  };
}

function totalItems(rows: readonly CountedRow[]): number {
  return rows.length === 0 ? 0 : Number(rows[0]?.totalItems ?? 0);
}
