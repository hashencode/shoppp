import type { SetupGuideDestination, SetupGuideDestinations } from '@shoppp/contracts'
import { Button, Card, List, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import { useHref } from 'react-router-dom'
import { fetchSetupGuide } from '../../services/platform/api'
import { QueryStateBlock } from '../../shared/components/query-state-block'
import { useI18n } from '../../shared/contexts/i18n-context'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'

void React

const destinationLabel: Record<SetupGuideDestination['id'], string> = {
  identity: 'Store identity',
  contact: 'Contact settings',
  policies: 'Policies',
  products: 'Products',
  collections: 'Collections',
  pages: 'Pages',
  articles: 'Articles',
  navigation: 'Navigation',
  themes: 'Themes and preview',
  shipping: 'Shipping settings',
  commerce: 'Commercial settings',
  inventory: 'Inventory',
  orders: 'Orders',
}

const destinationDescription: Record<SetupGuideDestination['id'], string> = {
  identity: 'Store name, shared logos, metadata, and global search presentation.',
  contact: 'Public contact channels and social profiles.',
  policies: 'Draft, approve, publish, and archive legal policies.',
  products: 'Product facts, media, variants, prices, and publication.',
  collections: 'Collection presentation and ordered Product membership.',
  pages: 'Merchant Pages and their storefront routes.',
  articles: 'Editorial Articles and their storefront routes.',
  navigation: 'Reusable Header and Footer menus.',
  themes: 'Presentation Blocks, exact candidate selection, private Preview, and approval.',
  shipping: 'Shipping zones, countries, and methods.',
  commerce: 'Currency, payment, checkout, and operational configuration.',
  inventory: 'Stock and availability facts.',
  orders: 'Orders and fulfillment operations.',
}

const DestinationLink = ({ destination }: { destination: SetupGuideDestination }) => {
  const { t } = useI18n()
  const href = useHref(destination.href)
  return (
    <List.Item
      actions={[
        <Button href={href} key="open">
          {t(destinationLabel[destination.id])}
        </Button>,
      ]}
    >
      <List.Item.Meta
        title={t(destinationLabel[destination.id])}
        description={t(destinationDescription[destination.id])}
      />
    </List.Item>
  )
}

export const WelcomePage = () => {
  const { t } = useI18n()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<
    | { status: 'loading' }
    | { status: 'failed' }
    | { status: 'ready'; summary: SetupGuideDestinations }
  >({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    void fetchSetupGuide(controller.signal).then(
      (summary) => setResult({ status: 'ready', summary }),
      () => {
        if (!controller.signal.aborted) setResult({ status: 'failed' })
      }
    )
    return () => controller.abort()
  }, [attempt])

  return (
    <CustomPageRecipe>
      <Card>
        <Typography.Paragraph>
          {t('Open the authority that owns the storefront fact you need to change.')}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          {t('Each editor shows its own saved, candidate, live, stale, and next-action state.')}
        </Typography.Paragraph>
        {result.status === 'failed' ? (
          <QueryStateBlock
            state="error"
            title={t('Setup destinations could not be loaded')}
            description={t('Retry after access or connectivity is restored.')}
            primaryActionLabel={t('Retry')}
            primaryActionButtonType="default"
            onPrimaryAction={() => {
              setResult({ status: 'loading' })
              setAttempt((value) => value + 1)
            }}
          />
        ) : result.status === 'loading' ? (
          <QueryStateBlock state="loading" title={t('Loading setup destinations…')} />
        ) : result.summary.destinations.length === 0 ? (
          <QueryStateBlock
            state="empty"
            title={t('No setup destinations are available')}
            description={t('Ask an administrator for read access to the required editor.')}
          />
        ) : (
          <List
            dataSource={result.summary.destinations}
            renderItem={(destination) => <DestinationLink destination={destination} />}
          />
        )}
      </Card>
    </CustomPageRecipe>
  )
}
