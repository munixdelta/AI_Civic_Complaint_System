from dataclasses import dataclass

from app.schemas.authority import AuthorityEvidence, AuthorityParty, AuthorityResult


class AuthorityProviderError(Exception):
    """Base error for authoritative-source lookup failures."""


class AuthorityProviderTimeout(AuthorityProviderError):
    """An authoritative provider did not respond in time."""


@dataclass(frozen=True)
class AuthorityLookup:
    road_owner: AuthorityParty | None = None
    maintenance_authority: AuthorityParty | None = None
    builder_or_contractor: AuthorityParty | None = None
    evidence: tuple[AuthorityEvidence, ...] = ()


class AuthoritySourceProvider:
    """Interface for future official authority data sources."""

    def lookup(self, *, latitude: float, longitude: float, context: dict[str, str | None]) -> AuthorityLookup | None:
        raise NotImplementedError


class NoConfiguredAuthorityProvider(AuthoritySourceProvider):
    """Safe default until an authoritative source is configured and verified."""

    def lookup(self, *, latitude: float, longitude: float, context: dict[str, str | None]) -> None:
        return None


authority_provider: AuthoritySourceProvider = NoConfiguredAuthorityProvider()


def resolve_authority(
    *,
    latitude: float,
    longitude: float,
    context: dict[str, str | None],
) -> AuthorityResult:
    lookup = authority_provider.lookup(
        latitude=latitude,
        longitude=longitude,
        context=context,
    )
    limitation = (
        "Administrative jurisdiction does not by itself establish responsible road authority. "
        "No authoritative road ownership or maintenance source verified this location."
    )
    if lookup is None:
        return AuthorityResult(authority_status="not_verified", limitations=[limitation])

    has_authority_claim = any((lookup.road_owner, lookup.maintenance_authority, lookup.builder_or_contractor))
    evidence = list(lookup.evidence)
    if not has_authority_claim or not evidence:
        return AuthorityResult(
            authority_status="not_verified",
            evidence=evidence,
            limitations=[limitation],
        )

    has_road_and_maintenance = bool(lookup.road_owner and lookup.maintenance_authority)
    return AuthorityResult(
        authority_status="verified" if has_road_and_maintenance else "partially_verified",
        road_owner=lookup.road_owner,
        maintenance_authority=lookup.maintenance_authority,
        builder_or_contractor=lookup.builder_or_contractor,
        evidence=evidence,
        limitations=[] if has_road_and_maintenance else [
            "Available authoritative evidence does not establish every authority role."
        ],
    )
