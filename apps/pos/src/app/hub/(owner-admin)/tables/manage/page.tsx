'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Info, Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  selectSelectedStoreId,
  useAuthStore,
} from '@/features/auth/store/auth.store';
import {
  getAllTables,
  syncTables,
} from '@/features/tables/services/table.services';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert';
import { Button } from '@repo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@repo/ui/components/form';
import { Input } from '@repo/ui/components/input';
import { ScrollArea } from '@repo/ui/components/scroll-area';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BatchUpsertTableDto,
  TableResponseDto,
} from '@/features/tables/types/table.types';
import type { ApiError } from '@/utils/apiFetch';
import { Skeleton } from '@repo/ui/components/skeleton';

const MAX_TABLES = 100;
const MAX_TABLE_NAME_LENGTH = 50;

export const tableBatchSchema = z.object({
  tables: z
    .array(
      z.object({
        id: z.string().uuid('Invalid ID format').optional(),
        name: z
          .string()
          .trim()
          .min(1, 'Table name cannot be empty.')
          .max(
            MAX_TABLE_NAME_LENGTH,
            `Table name cannot exceed ${MAX_TABLE_NAME_LENGTH} characters.`
          ),
      })
    )
    .min(
      0,
      'At least one table must be present to sync (or send empty to delete all).'
    )
    .max(MAX_TABLES, `Cannot exceed ${MAX_TABLES} tables.`)
    .refine(
      (tables) => {
        const names = tables.map((t) => t.name);
        return new Set(names).size === names.length;
      },
      { message: 'Table names in the list must be unique.', path: ['tables'] }
    ),
});

export type TableBatchFormData = z.infer<typeof tableBatchSchema>;
const storeTablesQueryKey = (storeId: string | null) => ['tables', storeId];

export default function StoreTablesPage() {
  const queryClient = useQueryClient();
  const selectedStoreId = useAuthStore(selectSelectedStoreId);

  const {
    data: fetchedTables,
    isLoading: isLoadingTables,
    isError: isTablesError,
    error: tablesError,
    isSuccess: isTablesSuccess,
  } = useQuery<TableResponseDto[], Error>({
    queryKey: storeTablesQueryKey(selectedStoreId),
    queryFn: async () => {
      if (!selectedStoreId) return [];
      return getAllTables(selectedStoreId);
    },
    enabled: !!selectedStoreId,
    refetchOnWindowFocus: false,
  });

  const form = useForm<TableBatchFormData>({
    resolver: zodResolver(tableBatchSchema),
    defaultValues: { tables: [] },
    mode: 'onChange',
  });

  const { fields, replace, remove, append } = useFieldArray({
    control: form.control,
    name: 'tables',
    keyName: 'fieldId',
  });

  useEffect(() => {
    if (isTablesSuccess && selectedStoreId && !form.formState.isDirty) {
      const initialTables =
        fetchedTables?.map((table) => ({ id: table.id, name: table.name })) ??
        [];
      console.log('Populating form with tables:', initialTables);
      form.reset({ tables: initialTables });
    }
  }, [fetchedTables, form, isTablesSuccess, selectedStoreId]);

  const syncTablesMutation = useMutation<
    TableResponseDto[],
    ApiError | Error,
    BatchUpsertTableDto
  >({
    mutationFn: async (payload: BatchUpsertTableDto) => {
      if (!selectedStoreId) throw new Error('Store not selected');
      const processedPayload = {
        tables: payload.tables.map((t) => ({ id: t.id, name: t.name.trim() })),
      };
      return syncTables(selectedStoreId, processedPayload);
    },
    onSuccess: (finalTableList) => {
      toast.success(`Tables synchronized successfully!`);
      queryClient.setQueryData(
        storeTablesQueryKey(selectedStoreId),
        finalTableList
      );
      form.reset({
        tables: finalTableList.map((table) => ({
          id: table.id,
          name: table.name,
        })),
      });
    },
    onError: (error) => {
      console.error('Failed to sync tables:', error);
    },
  });

  function onSubmit(values: TableBatchFormData) {
    if (!selectedStoreId) {
      toast.error('Cannot save: Store not selected.');
      return;
    }
    const apiPayload: BatchUpsertTableDto = {
      tables: values.tables.map((t) => ({ id: t.id, name: t.name.trim() })),
    };
    console.log('Submitting sync tables payload:', apiPayload);
    syncTablesMutation.mutate(apiPayload);
  }

  if (isLoadingTables) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 md:p-8">
        <header>
          <Skeleton className="mb-2 h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </header>
        <Skeleton className="h-20 w-full" />
        <Card>
          <CardHeader>
            <Skeleton className="mb-1 h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full" />
          </CardContent>
          <CardFooter className="flex justify-end gap-3 border-t px-6 py-4 dark:border-gray-700">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isTablesError) {
    return (
      <div className="text-destructive mx-auto max-w-4xl p-6 text-center">
        <AlertCircle className="text-destructive mx-auto mb-2 h-10 w-10" />
        <p className="font-semibold">Error Loading Existing Tables</p>
        {tablesError instanceof Error && (
          <p className="mt-1 text-sm">{tablesError.message}</p>
        )}
        <p className="mt-2 text-sm">Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 md:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Manage Tables</h1>
        <p className="text-muted-foreground">
          Add, edit, or remove tables available in your store layout.
        </p>
      </header>
      <Alert variant="destructive">
        <Info className="h-4 w-4" />
        <AlertTitle>Important: Synchronizes Tables</AlertTitle>
        <AlertDescription>
          Submitting this form will update or create tables based on this list.
          Any existing tables **not present** in this list (matched by ID)
          **will be deleted**. Ensure no tables intended for deletion have
          active orders.
        </AlertDescription>
      </Alert>
      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Removed Generator CardHeader & CardContent */}
            <CardHeader>
              <CardTitle>Edit Table List</CardTitle>
              <CardDescription>
                Add, remove, or rename tables below. The final list will
                synchronize with the server.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Dynamic Table Name List */}
              <div className="space-y-4">
                {/* Added container div */}
                <div className="mb-2 flex items-center justify-between">
                  <FormLabel className="text-base font-medium">
                    Tables ({fields.length})
                  </FormLabel>
                  {/* Add Single Table Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ name: '' })}
                    disabled={syncTablesMutation.isPending}
                    className="gap-1"
                  >
                    <Plus className="h-4 w-4" /> Add Table
                  </Button>
                </div>
                <ScrollArea className="h-80 w-full rounded-md border p-4 dark:border-gray-700">
                  {/* Adjusted height */}
                  {fields.length === 0 ? (
                    <p className="text-muted-foreground py-10 text-center text-sm italic">
                      No tables defined. Click &quot;Add Table&quot; to begin.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence initial={false}>
                        {fields.map((field, index) => (
                          <motion.div
                            key={field.fieldId}
                            layout
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{
                              opacity: 0,
                              x: -20,
                              transition: { duration: 0.15 },
                            }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className="flex items-center gap-2"
                          >
                            <FormField
                              control={form.control}
                              name={`tables.${index}.name`}
                              render={({ field: tableField }) => (
                                <FormItem className="flex-grow">
                                  <FormLabel className="sr-only">
                                    Table Name {index + 1}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder={`Table Name ${index + 1}`}
                                      {...tableField}
                                      disabled={syncTablesMutation.isPending}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
                              onClick={() => remove(index)}
                              disabled={syncTablesMutation.isPending}
                              title={`Remove Table ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </ScrollArea>
                {/* Display array-level errors */}
                <FormMessage>
                  {form.formState.errors.tables?.message}
                </FormMessage>
                <FormMessage>
                  {form.formState.errors.tables?.root?.message}
                  {/* For array min/refine errors */}
                </FormMessage>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-3 border-t px-6 py-4 dark:border-gray-700">
              {/* Reset button might reset to initially fetched state */}
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={syncTablesMutation.isPending}
              >
                Reset Changes
              </Button>
              <Button
                type="submit"
                disabled={
                  !selectedStoreId ||
                  syncTablesMutation.isPending ||
                  !form.formState.isValid ||
                  !form.formState.isDirty
                }
              >
                {syncTablesMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Sync Table List {/* Updated Button Text */}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
