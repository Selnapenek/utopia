import * as React from 'react'
import {
  GenericExternalResource,
  useExternalResources,
  ExternalResources,
} from '../../../printer-parsers/html/external-resources-parser'
import { betterReactMemo, MomentumContextMenu } from '../../../uuiui-deps'
import { GridRow } from '../../inspector/widgets/grid-row'
import { ResourcesListGridRowConfig } from './generic-external-resources-list'
import { MenuProvider } from 'react-contexify'
import { ContextMenuItem } from '../../context-menu-items'
import { NO_OP } from '../../../core/shared/utils'

interface GenericExternalResourcesListItemProps {
  value: GenericExternalResource
  index: number
  setEditingIndex: React.Dispatch<number | null>
}

function indexedUpdateDeleteGenericResource(
  index: number,
  oldValue: ExternalResources,
): ExternalResources {
  const workingResources = [...oldValue.genericExternalResources]
  workingResources.splice(index, 1)
  return {
    ...oldValue,
    genericExternalResources: workingResources,
  }
}

export const GenericExternalResourcesListItem = betterReactMemo<
  GenericExternalResourcesListItemProps
>('GenericExternalResourcesListItem', ({ value, index, setEditingIndex }) => {
  const { useSubmitValueFactory } = useExternalResources()
  const [deleteResource] = useSubmitValueFactory(indexedUpdateDeleteGenericResource)

  const onDoubleClick = React.useCallback(() => {
    setEditingIndex(index)
  }, [index, setEditingIndex])

  const menuId = `generic-external-resources-list-item-contextmenu-${index}`
  const menuItems: Array<ContextMenuItem<any>> = [
    {
      name: 'Delete',
      enabled: true,
      action: () => {
        deleteResource(index)
      },
    },
    {
      name: 'Rename',
      enabled: true,
      action: () => {
        setEditingIndex(index)
      },
    },
  ]

  return (
    <MenuProvider id={menuId} storeRef={false}>
      <GridRow
        {...ResourcesListGridRowConfig}
        style={{ paddingLeft: 12, paddingRight: 8 }}
        onDoubleClick={onDoubleClick}
      >
        <div
          style={{
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {value.href}
        </div>
        <div
          style={{
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textAlign: 'right',
            fontStyle: 'italic',
            paddingRight: 1,
          }}
        >
          {value.rel}
        </div>
        <MomentumContextMenu id={menuId} items={menuItems} getData={NO_OP} />
      </GridRow>
    </MenuProvider>
  )
})
