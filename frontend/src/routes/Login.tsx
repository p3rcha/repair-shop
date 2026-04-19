import { useEffect } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useAuth } from "@/lib/auth"
import { ApiError } from "@/lib/api"

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type FormValues = z.infer<typeof schema>

export function Login() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  })

  useEffect(() => {
    form.setFocus("username")
  }, [form])

  if (!loading && user) {
    return <Navigate to="/estimates" replace />
  }

  async function onSubmit(values: FormValues) {
    try {
      await login(values.username, values.password)
      toast.success("Logged in")
      navigate("/estimates", { replace: true })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Login failed"
      toast.error(message)
      form.setError("password", { message })
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <h1 className="font-mono text-center text-4xl font-semibold tracking-tight md:text-5xl">
          Repair Shop
        </h1>
        <Card className="w-full">
          <CardHeader>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Sign in to manage estimates
            </p>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <CardContent className="grid gap-5">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input autoComplete="username" placeholder="admin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          placeholder="********"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Signing in" : "Sign in"}
                </Button>
                <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  default: admin / admin123
                </p>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  )
}
