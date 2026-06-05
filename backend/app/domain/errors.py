"""Domain errors."""


class GameError(Exception):
    """Base error for expected game failures."""


class ValidationError(GameError):
    """Raised when a command violates game rules."""


class MissingError(GameError):
    """Raised when requested domain state does not exist."""

