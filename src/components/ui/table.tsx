"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  resizable?: boolean
  minColumnWidth?: number
  fixedLayout?: boolean
}

interface TableContextValue {
  resizable: boolean
  minColumnWidth: number
  registerColumn: (endExclusiveIndex: number) => void
  setColumnWidth: (index: number, width: number) => void
  resetColumnWidth: (index: number) => void
}

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  resizable?: boolean
}

const TableContext = React.createContext<TableContextValue | null>(null)

function assignColumnWidth(colElement: HTMLTableColElement | null, width?: number) {
  if (!colElement) return

  if (typeof width === "number") {
    const normalizedWidth = `${Math.round(width)}px`
    colElement.style.width = normalizedWidth
    colElement.style.minWidth = normalizedWidth
    return
  }

  colElement.style.removeProperty("width")
  colElement.style.removeProperty("min-width")
}

function mergeRefs<T>(...refs: Array<React.ForwardedRef<T> | undefined>) {
  return (value: T | null) => {
    refs.forEach((ref) => {
      if (!ref) return

      if (typeof ref === "function") {
        ref(value)
        return
      }

      ref.current = value
    })
  }
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  (
    {
      className,
      children,
      resizable = false,
      minColumnWidth = 96,
      fixedLayout = false,
      ...props
    },
    ref
  ) => {
    const [columnCount, setColumnCount] = React.useState(0)
    const columnWidthsRef = React.useRef<Record<number, number>>({})
    const columnRefs = React.useRef<Record<number, HTMLTableColElement | null>>({})

    const registerColumn = React.useCallback((endExclusiveIndex: number) => {
      setColumnCount((current) =>
        endExclusiveIndex > current ? endExclusiveIndex : current
      )
    }, [])

    const setColumnWidth = React.useCallback(
      (index: number, width: number) => {
        const normalizedWidth = Math.max(minColumnWidth, width)
        columnWidthsRef.current[index] = normalizedWidth
        assignColumnWidth(columnRefs.current[index] ?? null, normalizedWidth)
      },
      [minColumnWidth]
    )

    const resetColumnWidth = React.useCallback((index: number) => {
      delete columnWidthsRef.current[index]
      assignColumnWidth(columnRefs.current[index] ?? null)
    }, [])

    const contextValue = React.useMemo<TableContextValue>(
      () => ({
        resizable,
        minColumnWidth,
        registerColumn,
        setColumnWidth,
        resetColumnWidth,
      }),
      [minColumnWidth, registerColumn, resizable, resetColumnWidth, setColumnWidth]
    )

    return (
      <TableContext.Provider value={contextValue}>
        <div className="relative w-full overflow-auto">
          <table
            ref={ref}
            data-resizable={resizable ? "true" : undefined}
            className={cn(
              "caption-bottom text-[17px]",
              resizable
                ? fixedLayout
                  ? "min-w-full w-full table-fixed"
                  : "min-w-full w-max"
                : "w-full",
              className
            )}
            {...props}
          >
            {resizable && columnCount > 0 ? (
              <colgroup>
                {Array.from({ length: columnCount }, (_, index) => (
                  <col
                    key={index}
                    ref={(node) => {
                      columnRefs.current[index] = node
                      assignColumnWidth(node, columnWidthsRef.current[index])
                    }}
                  />
                ))}
              </colgroup>
            ) : null}
            {children}
          </table>
        </div>
      </TableContext.Provider>
    )
  }
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-bold [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, children, resizable = true, ...props }, ref) => {
    const tableContext = React.useContext(TableContext)
    const internalRef = React.useRef<HTMLTableCellElement>(null)

    const mergedRef = React.useMemo(
      () => mergeRefs(internalRef, ref),
      [ref]
    )

    const tableIsResizable = Boolean(tableContext?.resizable)
    const canResize = tableIsResizable && resizable && (props.colSpan ?? 1) === 1

    React.useLayoutEffect(() => {
      if (!tableIsResizable || !tableContext || !internalRef.current) return

      const headerCell = internalRef.current
      const endExclusiveIndex = headerCell.cellIndex + (headerCell.colSpan || 1)
      tableContext.registerColumn(endExclusiveIndex)
    }, [tableContext, tableIsResizable, props.colSpan])

    const handleResizeStart = React.useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        if (!canResize || !tableContext || !internalRef.current) return

        event.preventDefault()
        event.stopPropagation()

        const headerCell = internalRef.current
        const columnIndex = headerCell.cellIndex
        const startX = event.clientX
        const startWidth = headerCell.getBoundingClientRect().width
        const previousUserSelect = document.body.style.userSelect
        const previousCursor = document.body.style.cursor

        document.body.style.userSelect = "none"
        document.body.style.cursor = "col-resize"

        const cleanup = () => {
          document.body.style.userSelect = previousUserSelect
          document.body.style.cursor = previousCursor
          window.removeEventListener("pointermove", handlePointerMove)
          window.removeEventListener("pointerup", handlePointerUp)
          window.removeEventListener("pointercancel", handlePointerUp)
        }

        const handlePointerMove = (moveEvent: PointerEvent) => {
          tableContext.setColumnWidth(
            columnIndex,
            startWidth + (moveEvent.clientX - startX)
          )
        }

        const handlePointerUp = () => {
          cleanup()
        }

        window.addEventListener("pointermove", handlePointerMove)
        window.addEventListener("pointerup", handlePointerUp)
        window.addEventListener("pointercancel", handlePointerUp)
      },
      [canResize, tableContext]
    )

    const handleResetWidth = React.useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (!canResize || !tableContext || !internalRef.current) return

        event.preventDefault()
        event.stopPropagation()
        tableContext.resetColumnWidth(internalRef.current.cellIndex)
      },
      [canResize, tableContext]
    )

    return (
      <th
        ref={mergedRef}
        className={cn(
          "relative h-12 px-4 text-left align-middle text-[17px] font-bold text-muted-foreground [&:has([role=checkbox])]:pr-0",
          canResize && "pr-6",
          className
        )}
        {...props}
      >
        {children}
        {canResize ? (
          <div
            aria-hidden="true"
            className="table-column-resizer"
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={handleResetWidth}
            onPointerDown={handleResizeStart}
          />
        ) : null}
      </th>
    )
  }
)
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle text-[17px] [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-[17px] text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
